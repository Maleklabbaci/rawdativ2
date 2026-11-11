-- ============================================================================
-- Migration : Paiement en ligne d'abonnement Rawdha+ par CIB / Edahabia (SlickPay API v2)
-- Sécurité :
-- 1. Calcul serveur du tarif (1 900 DA / 5 700 DA / 19 000 DA) — aucun montant client accepté.
-- 2. Activation transactionnelle et 100 % idempotente (`FOR UPDATE`) via `service_role`
--    uniquement après confirmation officielle `GET /api/v2/users/invoices/{id}` (`completed = 1`).
-- ============================================================================

begin;

create table if not exists public.slickpay_subscription_orders (
  id text primary key,
  director_id text not null,
  director_name text not null default 'Directrice',
  creche_name text not null default 'Crèche',
  email text not null default '',
  telephone text,
  plan_months integer not null check (plan_months in (1, 3, 12)),
  amount_dzd integer not null check (amount_dzd >= 100),
  coupon_code text,
  slickpay_invoice_id text,
  payment_url text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  rejection_reason text,
  new_end_date text,
  paid_at timestamptz,
  raw_slickpay_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_slickpay_orders_director_created
  on public.slickpay_subscription_orders (director_id, created_at desc);

create unique index if not exists idx_slickpay_orders_invoice_unique
  on public.slickpay_subscription_orders (slickpay_invoice_id)
  where slickpay_invoice_id is not null;

alter table public.slickpay_subscription_orders enable row level security;

revoke all on table public.slickpay_subscription_orders from public, anon, authenticated;
grant select on table public.slickpay_subscription_orders to authenticated;

drop policy if exists slickpay_orders_select_own_or_admin on public.slickpay_subscription_orders;
create policy slickpay_orders_select_own_or_admin
  on public.slickpay_subscription_orders
  for select
  to authenticated
  using (
    auth.uid() is not null
    and (
      director_id = auth.uid()::text
      or coalesce(public.rawdha_is_admin(), false)
    )
  );

-- Activation atomique et idempotente d'une commande SlickPay confirmée.
-- Exécutable exclusivement par `service_role` (Edge Functions `slickpay-checkout` / `slickpay-webhook`).
create or replace function public.confirm_slickpay_subscription_order(
  p_order_id text,
  p_slickpay_invoice_id text default null,
  p_raw_response jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.slickpay_subscription_orders%rowtype;
  v_compte_data jsonb;
  v_current_end_str text;
  v_anchor_date date;
  v_new_end_date text;
  v_param_id text;
  v_param_data jsonb;
  v_existing_items jsonb;
  v_renewal_entry jsonb;
  v_tx_ref text;
begin
  if nullif(trim(p_order_id), '') is null then
    raise exception 'slickpay_invalid_order_id' using errcode = '22023';
  end if;

  select *
    into v_order
    from public.slickpay_subscription_orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'slickpay_order_not_found' using errcode = 'P0002';
  end if;

  -- Idempotence stricte : si le webhook et le retour navigateur arrivent en même temps,
  -- le second appel retourne immédiatement la date déjà prolongée sans double crédit.
  if v_order.status = 'paid' then
    return jsonb_build_object(
      'alreadyPaid', true,
      'orderId', v_order.id,
      'directorId', v_order.director_id,
      'planMonths', v_order.plan_months,
      'amountDzd', v_order.amount_dzd,
      'newEndDate', v_order.new_end_date
    );
  end if;

  select data
    into v_compte_data
    from public.comptes
   where id = v_order.director_id
   for update;

  if v_compte_data is null then
    raise exception 'slickpay_director_not_found' using errcode = 'P0002';
  end if;

  v_current_end_str := coalesce(v_compte_data->>'dateFinAbonnement', '');
  v_anchor_date := current_date;
  if v_current_end_str ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    begin
      if v_current_end_str::date > current_date then
        v_anchor_date := v_current_end_str::date;
      end if;
    exception when others then
      v_anchor_date := current_date;
    end;
  end if;

  v_new_end_date := to_char((v_anchor_date + make_interval(months => v_order.plan_months))::date, 'YYYY-MM-DD');

  update public.comptes
     set data = coalesce(v_compte_data, '{}'::jsonb) || jsonb_build_object(
       'abonnementActif', true,
       'dateFinAbonnement', v_new_end_date
     )
   where id = v_order.director_id;

  v_tx_ref := 'SLICKPAY-' || coalesce(nullif(trim(p_slickpay_invoice_id), ''), nullif(trim(v_order.slickpay_invoice_id), ''), v_order.id);

  update public.slickpay_subscription_orders
     set status = 'paid',
         slickpay_invoice_id = coalesce(nullif(trim(p_slickpay_invoice_id), ''), slickpay_invoice_id),
         new_end_date = v_new_end_date,
         paid_at = now(),
         raw_slickpay_response = coalesce(p_raw_response, '{}'::jsonb),
         updated_at = now()
   where id = v_order.id;

  -- Journaliser automatiquement le paiement approuvé dans l'historique d'abonnement (`parametres`)
  v_param_id := 'abonnement_' || v_order.director_id;
  select data into v_param_data from public.parametres where id = v_param_id for update;
  v_existing_items := case
    when v_param_data is not null and jsonb_typeof(v_param_data->'items') = 'array' then v_param_data->'items'
    else '[]'::jsonb
  end;

  v_renewal_entry := jsonb_build_object(
    'id', 'ren_spk_' || v_order.id,
    'directorId', v_order.director_id,
    'directorName', v_order.director_name,
    'crecheName', v_order.creche_name,
    'email', v_order.email,
    'telephone', v_order.telephone,
    'planMonths', v_order.plan_months,
    'amountDzd', v_order.amount_dzd,
    'couponCode', v_order.coupon_code,
    'paymentChannel', 'SlickPay',
    'transactionRef', v_tx_ref,
    'status', 'approved',
    'createdAt', to_char(v_order.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'reviewedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'reviewedBy', 'SlickPay SATIM (CIB / Edahabia)'
  );

  insert into public.parametres (id, data)
  values (
    v_param_id,
    jsonb_build_object(
      'id', v_param_id,
      'version', 1,
      'items', jsonb_build_array(v_renewal_entry) || v_existing_items
    )
  )
  on conflict (id) do update
    set data = jsonb_build_object(
      'id', v_param_id,
      'version', 1,
      'items', jsonb_build_array(v_renewal_entry) || v_existing_items
    );

  return jsonb_build_object(
    'alreadyPaid', false,
    'orderId', v_order.id,
    'directorId', v_order.director_id,
    'planMonths', v_order.plan_months,
    'amountDzd', v_order.amount_dzd,
    'newEndDate', v_new_end_date,
    'transactionRef', v_tx_ref
  );
end;
$$;

revoke all on function public.confirm_slickpay_subscription_order(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_slickpay_subscription_order(text, text, jsonb) to service_role;

-- Activer Supabase Realtime (CDC) sur `slickpay_subscription_orders` pour que l'interface
-- bascule instantanément dès que le Webhook SlickPay confirme `status = 'paid'` en arrière-plan.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.slickpay_subscription_orders;
  end if;
exception when others then
  null;
end;
$$;

commit;
