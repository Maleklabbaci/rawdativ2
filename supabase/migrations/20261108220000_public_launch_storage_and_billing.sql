-- Migration de lancement public Rawdha+ :
-- 1. Annulation comptable tracée (`cancel_invoice` -> statut = 'Annulé') sans suppression physique,
--    libérant proprement la période (`periodeCle`) et levant les blocages de doublons liés.
-- 2. Provisionnement des buckets privés Supabase Storage (`child-documents`, `subscription-proofs`)
--    isolés par crèche (< 2 Mo, PDF/JPG/PNG/WebP).
begin;
lock table public.enfants, public.paiements, public.rawdha_invoice_review_events in share row exclusive mode;

-- 1. Autoriser l'action 'cancel_invoice' dans le journal des événements comptables
alter table public.rawdha_invoice_review_events
  drop constraint if exists rawdha_invoice_review_events_action_check;

alter table public.rawdha_invoice_review_events
  add constraint rawdha_invoice_review_events_action_check
  check (action in ('correct_period', 'flag_duplicate', 'clear_suspicion', 'cancel_invoice'));

-- 2. Index d'unicité partiel excluant les factures annulées comptablement
drop index if exists public.rawdha_payment_child_period_unique;
create unique index rawdha_payment_child_period_unique
  on public.paiements ((data->>'enfantId'), (data->>'periodeCle'))
  where (data ? 'periodeCle' and coalesce(data->>'statut', '') <> 'Annulé');

-- 3. Mise à jour du garde-fou de doublons : une facture annulée ne bloque plus sa paire
create or replace function public.rawdha_invoice_review_guard(p_child text, p_invoice_id text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner text;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  select data->>'crecheId' into v_owner from public.enfants where id=p_child for update;
  if nullif(trim(v_owner),'') is null or (not coalesce(public.rawdha_is_admin(),false) and v_owner<>auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode='42501';
  end if;
  if exists (
    select 1
    from public.paiements p
    left join public.paiements t on t.id = p.data->'doublonSuspect'->>'targetInvoiceId'
    where p.data->>'enfantId' = p_child
      and p.data ? 'doublonSuspect'
      and coalesce(p.data->>'statut', '') <> 'Annulé'
      and coalesce(t.data->>'statut', '') <> 'Annulé'
      and (p_invoice_id is null or p.id = p_invoice_id or p.data->'doublonSuspect'->>'targetInvoiceId' = p_invoice_id)
  ) then
    raise exception 'finance_duplicate_review_pending' using errcode='55000';
  end if;
end $$;
revoke all on function public.rawdha_invoice_review_guard(text,text) from public,anon,authenticated;

-- 4. Mise à jour de rawdha_write_invoice_internal pour ignorer les factures annulées lors de la réémission
create or replace function public.rawdha_write_invoice_internal(p_action text, p_id text, p_patch jsonb, p_expected jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_before jsonb; v_current jsonb; v_next jsonb; v_child_data jsonb; v_child text;
  v_owner text; v_key text; v_field text; v_amount numeric; v_date text;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('create','update') or nullif(trim(p_id),'') is null or length(p_id)>200
    or jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'finance_invalid_request' using errcode='22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k where k not in
    ('enfantId','montant','statut','moisConcerne','dateEcheance','moyenPaiement','typeFacture','periodeCle','notes')) then
    raise exception 'finance_invalid_field' using errcode='22023';
  end if;
  if p_action='create' then
    v_child := p_patch->>'enfantId';
  else
    select data into v_before from public.paiements where id=p_id;
    if v_before is null then raise exception 'finance_not_found' using errcode='P0002'; end if;
    v_child := v_before->>'enfantId';
  end if;
  if nullif(trim(v_child),'') is null then raise exception 'finance_invalid_child' using errcode='22023'; end if;
  select data into v_child_data from public.enfants where id=v_child for update;
  v_owner := v_child_data->>'crecheId';
  if nullif(trim(v_owner),'') is null or (not coalesce(public.rawdha_is_admin(),false) and v_owner<>auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode='42501';
  end if;
  if p_action='create' then
    if v_child_data->>'statut' is distinct from 'Actif' then raise exception 'finance_child_inactive' using errcode='22023'; end if;
    v_key := p_patch->>'periodeCle';
    if v_key is null or substring(v_key from 3 for 4)='0000' or (v_key !~ '^M:[0-9]{4}-(0[1-9]|1[0-2])$' and v_key !~ '^A:[0-9]{4}$')
      or (left(v_key,2)='M:' and (p_patch->>'typeFacture' is distinct from 'Mensuel' or p_patch->>'moisConcerne' is distinct from substring(v_key from 3)))
      or (left(v_key,2)='A:' and (p_patch->>'typeFacture' is distinct from 'Annuel' or p_patch->>'moisConcerne' is distinct from substring(v_key from 3))) then
      raise exception 'finance_invalid_period' using errcode='22023';
    end if;
    select data into v_current from public.paiements where id=p_id for update;
    if v_current is not null then
      if v_current=p_patch then return v_current || jsonb_build_object('id',p_id); end if;
      raise exception 'finance_request_id_conflict' using errcode='23505';
    end if;
    if exists (select 1 from public.paiements where data->>'enfantId'=v_child and coalesce(data->>'statut','')<>'Annulé' and not (data ? 'periodeCle')) then
      raise exception 'finance_legacy_review_required' using errcode='55000';
    end if;
    if exists (select 1 from public.paiements where data->>'enfantId'=v_child and coalesce(data->>'statut','')<>'Annulé' and (
      data->>'periodeCle'=v_key or
      (substring(data->>'periodeCle' from 3 for 4)=substring(v_key from 3 for 4) and
        ((left(data->>'periodeCle',2)='A:' and left(v_key,2)='M:') or (left(data->>'periodeCle',2)='M:' and left(v_key,2)='A:')))
    )) then raise exception 'finance_period_overlap' using errcode='23505'; end if;
    v_next := p_patch;
  else
    select data into v_current from public.paiements where id=p_id for update;
    if v_current is null or v_current->>'enfantId' is distinct from v_child or jsonb_typeof(p_expected) is distinct from 'object'
      or (p_expected - 'id') is distinct from (v_current - 'id') then
      raise exception 'finance_changed' using errcode='40001';
    end if;
    if coalesce(v_current->>'statut','')='Annulé' then
      raise exception 'finance_invalid_status' using errcode='22023';
    end if;
    if p_patch ?| array['enfantId','moisConcerne','typeFacture','periodeCle'] then
      raise exception 'finance_identity_immutable' using errcode='22023';
    end if;
    v_next := v_current;
    for v_field in select jsonb_object_keys(p_patch) loop
      if p_patch->v_field = 'null'::jsonb then v_next := v_next - v_field;
      else v_next := jsonb_set(v_next,array[v_field],p_patch->v_field,true); end if;
    end loop;
  end if;
  if jsonb_typeof(v_next->'montant') is distinct from 'number' then raise exception 'finance_invalid_amount' using errcode='22023'; end if;
  v_amount := (v_next->>'montant')::numeric;
  if v_amount<=0 or v_amount>1000000000 or trunc(v_amount,2)<>v_amount then raise exception 'finance_invalid_amount' using errcode='22023'; end if;
  if coalesce(v_next->>'statut','') not in ('Payé','En attente','Retard') then raise exception 'finance_invalid_status' using errcode='22023'; end if;
  if v_next ? 'dateEcheance' then
    v_date := v_next->>'dateEcheance';
    if not public.rawdha_finance_valid_date(v_date) then raise exception 'finance_invalid_date' using errcode='22023'; end if;
  end if;
  if v_next ? 'moyenPaiement' and coalesce(v_next->>'moyenPaiement','') not in ('Espèces','Chèque','Virement','Carte') then
    raise exception 'finance_invalid_method' using errcode='22023';
  end if;
  if v_next ? 'notes' and (jsonb_typeof(v_next->'notes') is distinct from 'string' or length(v_next->>'notes')>2000) then
    raise exception 'finance_invalid_notes' using errcode='22023';
  end if;
  if p_action='create' then insert into public.paiements(id,data) values(p_id,v_next);
  else update public.paiements set data=v_next where id=p_id; end if;
  return v_next || jsonb_build_object('id',p_id);
end $$;
revoke all on function public.rawdha_write_invoice_internal(text,text,jsonb,jsonb) from public,anon,authenticated;

-- 5. Action comptable étendue avec support de 'cancel_invoice'
create or replace function public.rawdha_invoice_review_action(
  p_request_id text,p_action text,p_invoice_id text,p_expected jsonb,p_period_key text,
  p_target_invoice_id text,p_target_expected jsonb,p_reason text,p_confirmed boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_before jsonb; v_current jsonb; v_after jsonb; v_target jsonb; v_child text; v_owner text; v_event public.rawdha_invoice_review_events%rowtype;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  if nullif(trim(p_request_id),'') is null or length(p_request_id)>200 or nullif(trim(p_invoice_id),'') is null
    or p_action is null or p_action not in ('correct_period','flag_duplicate','clear_suspicion','cancel_invoice')
    or jsonb_typeof(p_expected) is distinct from 'object' or nullif(trim(p_reason),'') is null or length(trim(p_reason))>500
    or p_confirmed is distinct from true then raise exception 'finance_invalid_review_action' using errcode='22023'; end if;
  if (p_action='correct_period' and (p_period_key is null or substring(p_period_key from 3 for 4)='0000'
        or (p_period_key !~ '^M:[0-9]{4}-(0[1-9]|1[0-2])$' and p_period_key !~ '^A:[0-9]{4}$')
        or p_target_invoice_id is not null or p_target_expected is not null))
    or (p_action='flag_duplicate' and (p_period_key is not null or nullif(trim(p_target_invoice_id),'') is null
        or p_target_invoice_id=p_invoice_id or jsonb_typeof(p_target_expected) is distinct from 'object'))
    or (p_action in ('clear_suspicion','cancel_invoice') and (p_period_key is not null or p_target_invoice_id is not null or p_target_expected is not null))
    then raise exception 'finance_invalid_review_action' using errcode='22023'; end if;

  select data into v_before from public.paiements where id=p_invoice_id;
  if v_before is null then raise exception 'finance_not_found' using errcode='P0002'; end if;
  v_child:=v_before->>'enfantId';
  select data->>'crecheId' into v_owner from public.enfants where id=v_child for update;
  if nullif(trim(v_owner),'') is null or (not coalesce(public.rawdha_is_admin(),false) and v_owner<>auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode='42501';
  end if;
  select data into v_current from public.paiements where id=p_invoice_id for update;
  if v_current is null or v_current->>'enfantId' is distinct from v_child then raise exception 'finance_changed' using errcode='40001'; end if;
  select * into v_event from public.rawdha_invoice_review_events where request_id=p_request_id;
  if found then
    if v_event.invoice_id=p_invoice_id and v_event.creche_id=v_owner and v_event.created_by=auth.uid() and v_event.action=p_action
      and v_event.period_key is not distinct from p_period_key and v_event.target_invoice_id is not distinct from p_target_invoice_id
      and v_event.reason=trim(p_reason) and (v_event.before_data-'id')=(p_expected-'id')
      and (v_event.target_before-'id') is not distinct from (p_target_expected-'id') and v_event.after_data=v_current then
      return v_current || jsonb_build_object('id',p_invoice_id);
    end if;
    raise exception 'finance_review_request_conflict' using errcode='23505';
  end if;
  if (p_expected-'id') is distinct from (v_current-'id') then raise exception 'finance_changed' using errcode='40001'; end if;

  if p_action='correct_period' then
    perform public.rawdha_invoice_review_guard(v_child,p_invoice_id);
    if coalesce(v_current->>'statut','')='Annulé' or not (v_current ? 'periodeCle') or v_current->>'periodeCle'=p_period_key then
      raise exception 'finance_invalid_review_action' using errcode='22023';
    end if;
    if exists (select 1 from public.paiements p where p.id<>p_invoice_id and coalesce(p.data->>'statut','')<>'Annulé' and p.data->>'enfantId'=v_child and (
      p.data->>'periodeCle'=p_period_key or (substring(p.data->>'periodeCle' from 3 for 4)=substring(p_period_key from 3 for 4) and
      ((left(p.data->>'periodeCle',2)='A:' and left(p_period_key,2)='M:') or (left(p.data->>'periodeCle',2)='M:' and left(p_period_key,2)='A:')))))
      then raise exception 'finance_period_overlap' using errcode='23505'; end if;
    v_after:=jsonb_set(v_current,'{periodeCle}',to_jsonb(p_period_key),true);
  elsif p_action='flag_duplicate' then
    perform public.rawdha_invoice_review_guard(v_child,p_invoice_id);
    perform public.rawdha_invoice_review_guard(v_child,p_target_invoice_id);
    select data into v_target from public.paiements where id=p_target_invoice_id for update;
    if v_target is null or v_target->>'enfantId' is distinct from v_child
      or coalesce(v_current->>'statut','')='Annulé' or coalesce(v_target->>'statut','')='Annulé' then
      raise exception 'finance_invalid_duplicate_target' using errcode='22023';
    end if;
    if (p_target_expected-'id') is distinct from (v_target-'id') then raise exception 'finance_changed' using errcode='40001'; end if;
    v_after:=v_current || jsonb_build_object('doublonSuspect',jsonb_build_object('targetInvoiceId',p_target_invoice_id,'eventId',p_request_id));
  elsif p_action='clear_suspicion' then
    if not (v_current ? 'doublonSuspect') then raise exception 'finance_invalid_review_action' using errcode='22023'; end if;
    v_after:=v_current-'doublonSuspect';
  elsif p_action='cancel_invoice' then
    if coalesce(v_current->>'statut','')='Annulé' then raise exception 'finance_invalid_review_action' using errcode='22023'; end if;
    v_after:=(v_current - 'doublonSuspect') || jsonb_build_object(
      'statut','Annulé',
      'motifAnnulation',trim(p_reason),
      'dateAnnulation',to_char(now(),'YYYY-MM-DD')
    );
  end if;

  insert into public.rawdha_invoice_review_events(request_id,invoice_id,enfant_id,creche_id,action,period_key,target_invoice_id,reason,before_data,after_data,target_before,created_by)
    values(p_request_id,p_invoice_id,v_child,v_owner,p_action,p_period_key,p_target_invoice_id,trim(p_reason),v_current,v_after,v_target,auth.uid());
  update public.paiements set data=v_after where id=p_invoice_id;
  return v_after || jsonb_build_object('id',p_invoice_id);
end $$;
revoke all on function public.rawdha_invoice_review_action(text,text,text,jsonb,text,text,jsonb,text,boolean) from public,anon;
grant execute on function public.rawdha_invoice_review_action(text,text,text,jsonb,text,text,jsonb,text,boolean) to authenticated;

-- 6. Buckets privés Supabase Storage (exécuté uniquement lorsque le schéma storage existe)
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('child-documents', 'child-documents', false, 2097152, array['application/pdf','image/jpeg','image/png','image/webp']),
      ('subscription-proofs', 'subscription-proofs', false, 2097152, array['application/pdf','image/jpeg','image/png','image/webp'])
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists rawdha_child_docs_owner_select on storage.objects';
    execute 'drop policy if exists rawdha_child_docs_owner_insert on storage.objects';
    execute 'drop policy if exists rawdha_child_docs_owner_update on storage.objects';
    execute 'drop policy if exists rawdha_sub_proofs_access on storage.objects';
    execute 'drop policy if exists rawdha_sub_proofs_insert on storage.objects';

    execute $pol$
      create policy rawdha_child_docs_owner_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'child-documents'
        and (coalesce(public.rawdha_is_admin(), false) or split_part(name, '/', 1) = auth.uid()::text)
      )
    $pol$;

    execute $pol$
      create policy rawdha_child_docs_owner_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'child-documents'
        and coalesce(public.rawdha_is_approved_director(), false)
        and split_part(name, '/', 1) = auth.uid()::text
      )
    $pol$;

    execute $pol$
      create policy rawdha_child_docs_owner_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'child-documents'
        and coalesce(public.rawdha_is_approved_director(), false)
        and split_part(name, '/', 1) = auth.uid()::text
      )
    $pol$;

    execute $pol$
      create policy rawdha_sub_proofs_access on storage.objects
      for select to authenticated
      using (
        bucket_id = 'subscription-proofs'
        and (coalesce(public.rawdha_is_admin(), false) or split_part(name, '/', 1) = auth.uid()::text)
      )
    $pol$;

    execute $pol$
      create policy rawdha_sub_proofs_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'subscription-proofs'
        and split_part(name, '/', 1) = auth.uid()::text
      )
    $pol$;
  end if;

  -- 5. Synchronisation cloud isolée par crèche dans public.parametres
  --    (acomptes_<uid>, rh_<uid>, abonnement_<uid> en complément de creche_<uid>)
  if to_regclass('public.parametres') is not null then
    execute 'drop policy if exists "parametres_select" on public.parametres';
    execute 'drop policy if exists "parametres_insert" on public.parametres';
    execute 'drop policy if exists "parametres_update" on public.parametres';
    execute 'drop policy if exists "parametres_delete" on public.parametres';

    execute $pol$
      create policy "parametres_select" on public.parametres
      for select to authenticated
      using (
        coalesce(public.rawdha_is_admin(), false)
        or id in (
          'creche_' || auth.uid()::text,
          'acomptes_' || auth.uid()::text,
          'rh_' || auth.uid()::text,
          'abonnement_' || auth.uid()::text
        )
      )
    $pol$;

    execute $pol$
      create policy "parametres_insert" on public.parametres
      for insert to authenticated
      with check (
        coalesce(public.rawdha_is_admin(), false)
        or (
          coalesce(public.rawdha_is_approved_director(), false)
          and id in (
            'creche_' || auth.uid()::text,
            'acomptes_' || auth.uid()::text,
            'rh_' || auth.uid()::text
          )
        )
        or (auth.uid() is not null and id = 'abonnement_' || auth.uid()::text)
      )
    $pol$;

    execute $pol$
      create policy "parametres_update" on public.parametres
      for update to authenticated
      using (
        coalesce(public.rawdha_is_admin(), false)
        or (
          coalesce(public.rawdha_is_approved_director(), false)
          and id in (
            'creche_' || auth.uid()::text,
            'acomptes_' || auth.uid()::text,
            'rh_' || auth.uid()::text
          )
        )
        or (auth.uid() is not null and id = 'abonnement_' || auth.uid()::text)
      )
      with check (
        coalesce(public.rawdha_is_admin(), false)
        or (
          coalesce(public.rawdha_is_approved_director(), false)
          and id in (
            'creche_' || auth.uid()::text,
            'acomptes_' || auth.uid()::text,
            'rh_' || auth.uid()::text
          )
        )
        or (auth.uid() is not null and id = 'abonnement_' || auth.uid()::text)
      )
    $pol$;

    execute $pol$
      create policy "parametres_delete" on public.parametres
      for delete to authenticated
      using (
        coalesce(public.rawdha_is_admin(), false)
        or (
          coalesce(public.rawdha_is_approved_director(), false)
          and id in (
            'creche_' || auth.uid()::text,
            'acomptes_' || auth.uid()::text,
            'rh_' || auth.uid()::text
          )
        )
      )
    $pol$;
  end if;
end $$;

commit;
