-- STAGING ONLY. Requires 20261108170000 and its prerequisite account migrations.
-- Manual classification only: never guess a period, delete or merge an invoice.
begin;

do $$ begin
  if to_regclass('public.rawdha_invoice_period_reviews') is not null then
    raise exception 'finance_review_table_already_exists' using errcode='42P07';
  end if;
end $$;

create table public.rawdha_invoice_period_reviews (
  invoice_id text primary key references public.paiements(id) on delete restrict,
  enfant_id text not null references public.enfants(id) on delete restrict,
  creche_id text not null,
  period_key text not null,
  reason text not null,
  original_data jsonb not null,
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default now()
);
alter table public.rawdha_invoice_period_reviews enable row level security;
revoke all on public.rawdha_invoice_period_reviews from public,anon,authenticated;

-- Locks child then invoice, in the same order as rawdha_write_invoice. A human
-- declaration is recorded, not an assurance that the source was correct.
create function public.rawdha_review_invoice_period(
  p_invoice_id text, p_expected jsonb, p_period_key text, p_reason text, p_confirmed boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_before jsonb; v_current jsonb; v_child text; v_owner text; v_record public.rawdha_invoice_period_reviews%rowtype;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  if nullif(trim(p_invoice_id),'') is null or length(p_invoice_id)>200 or jsonb_typeof(p_expected) is distinct from 'object'
    or p_confirmed is distinct from true or nullif(trim(p_reason),'') is null or length(trim(p_reason))>500 then
    raise exception 'finance_invalid_review' using errcode='22023';
  end if;
  if p_period_key is null or substring(p_period_key from 3 for 4)='0000'
    or (p_period_key !~ '^M:[0-9]{4}-(0[1-9]|1[0-2])$' and p_period_key !~ '^A:[0-9]{4}$') then
    raise exception 'finance_invalid_period' using errcode='22023';
  end if;
  select data into v_before from public.paiements where id=p_invoice_id;
  if v_before is null then raise exception 'finance_not_found' using errcode='P0002'; end if;
  v_child := v_before->>'enfantId';
  select data->>'crecheId' into v_owner from public.enfants where id=v_child for update;
  if nullif(trim(v_owner),'') is null or (not coalesce(public.rawdha_is_admin(),false) and v_owner<>auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode='42501';
  end if;
  select data into v_current from public.paiements where id=p_invoice_id for update;
  if v_current is null or v_current->>'enfantId' is distinct from v_child then raise exception 'finance_changed' using errcode='40001'; end if;
  if v_current ? 'periodeCle' then
    -- An identical retry is safe only if this exact review is still the current row.
    select * into v_record from public.rawdha_invoice_period_reviews where invoice_id=p_invoice_id and enfant_id=v_child and creche_id=v_owner;
    if found and v_record.reviewed_by=auth.uid() and v_record.period_key=p_period_key and v_record.reason=trim(p_reason)
      and (v_record.original_data-'id')=(p_expected-'id') and v_current=(v_record.original_data || jsonb_build_object('periodeCle',p_period_key)) then
      return v_current || jsonb_build_object('id',p_invoice_id);
    end if;
    raise exception 'finance_review_already_classified' using errcode='55000';
  end if;
  if (p_expected-'id') is distinct from (v_current-'id') then raise exception 'finance_changed' using errcode='40001'; end if;
  if exists (select 1 from public.paiements p where p.id<>p_invoice_id and p.data->>'enfantId'=v_child and (
    p.data->>'periodeCle'=p_period_key or
    (substring(p.data->>'periodeCle' from 3 for 4)=substring(p_period_key from 3 for 4) and
      ((left(p.data->>'periodeCle',2)='A:' and left(p_period_key,2)='M:') or (left(p.data->>'periodeCle',2)='M:' and left(p_period_key,2)='A:')))
  )) then raise exception 'finance_period_overlap' using errcode='23505'; end if;
  insert into public.rawdha_invoice_period_reviews(invoice_id,enfant_id,creche_id,period_key,reason,original_data,reviewed_by)
    values(p_invoice_id,v_child,v_owner,p_period_key,trim(p_reason),v_current,auth.uid());
  -- Only add a key: the original human-entered label, amounts, statuses and all
  -- other legacy properties remain unchanged. The audit preserves the snapshot.
  v_current := v_current || jsonb_build_object('periodeCle',p_period_key);
  update public.paiements set data=v_current where id=p_invoice_id;
  return v_current || jsonb_build_object('id',p_invoice_id);
end $$;

create function public.rawdha_get_invoice_period_review(p_invoice_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_child text; v_owner text; v_review public.rawdha_invoice_period_reviews%rowtype;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  select data->>'enfantId' into v_child from public.paiements where id=p_invoice_id;
  select data->>'crecheId' into v_owner from public.enfants where id=v_child for share;
  if nullif(trim(v_owner),'') is null or (not coalesce(public.rawdha_is_admin(),false) and v_owner<>auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode='42501';
  end if;
  select * into v_review from public.rawdha_invoice_period_reviews where invoice_id=p_invoice_id and enfant_id=v_child and creche_id=v_owner;
  if not found then return null; end if;
  return jsonb_build_object('invoiceId',v_review.invoice_id,'enfantId',v_review.enfant_id,'periodKey',v_review.period_key,
    'reason',v_review.reason,'originalData',v_review.original_data,'reviewedBy',v_review.reviewed_by,'reviewedAt',v_review.reviewed_at);
end $$;

revoke all on function public.rawdha_review_invoice_period(text,jsonb,text,text,boolean) from public,anon;
revoke all on function public.rawdha_get_invoice_period_review(text) from public,anon;
grant execute on function public.rawdha_review_invoice_period(text,jsonb,text,text,boolean) to authenticated;
grant execute on function public.rawdha_get_invoice_period_review(text) to authenticated;
commit;
