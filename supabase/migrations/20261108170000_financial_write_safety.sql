-- STAGING ONLY. Requires the account and explicit-approval migrations and the
-- matching client. Historical rows are not rewritten or inferred. Existing
-- noncanonical invoices block new invoices for that child until reconciliation.
-- This is not a ledger, audit trail, payment gateway, or production rollout.
begin;
lock table public.enfants, public.paiements in share row exclusive mode;

-- Never install a partial uniqueness rule over conflicting or malformed keyed data.
do $$
begin
  -- Orphan rows cannot be associated with a child and therefore cannot be
  -- ruled out as a duplicate. Stop instead of inventing an association.
  if exists (select 1 from public.paiements p where jsonb_typeof(p.data) is distinct from 'object'
    or jsonb_typeof(p.data->'enfantId') is distinct from 'string' or nullif(trim(p.data->>'enfantId'),'') is null
    or not exists (select 1 from public.enfants e where e.id=p.data->>'enfantId' and nullif(trim(e.data->>'crecheId'),'') is not null))
    then raise exception 'finance_legacy_orphan_or_invalid' using errcode='23514'; end if;
  if exists (select 1 from public.paiements p where p.data ? 'periodeCle' and (
    jsonb_typeof(p.data) is distinct from 'object' or
    jsonb_typeof(p.data->'periodeCle') is distinct from 'string' or
    (p.data->>'periodeCle' !~ '^M:[0-9]{4}-(0[1-9]|1[0-2])$' and p.data->>'periodeCle' !~ '^A:[0-9]{4}$') or
    substring(p.data->>'periodeCle' from 3 for 4)='0000' or
    (left(p.data->>'periodeCle',2)='M:' and (p.data->>'typeFacture' is distinct from 'Mensuel' or p.data->>'moisConcerne' is distinct from substring(p.data->>'periodeCle' from 3))) or
    (left(p.data->>'periodeCle',2)='A:' and (p.data->>'typeFacture' is distinct from 'Annuel' or p.data->>'moisConcerne' is distinct from substring(p.data->>'periodeCle' from 3))) or
    nullif(trim(p.data->>'enfantId'),'') is null or
    not exists (select 1 from public.enfants e where e.id=p.data->>'enfantId' and nullif(trim(e.data->>'crecheId'),'') is not null)
  )) then raise exception 'finance_legacy_invalid_keyed_rows' using errcode='23514'; end if;
  if exists (select 1 from public.paiements where data ? 'periodeCle' group by data->>'enfantId',data->>'periodeCle' having count(*) > 1)
    then raise exception 'finance_legacy_keyed_duplicates' using errcode='23505'; end if;
  if exists (select 1 from public.paiements a join public.paiements m on a.data->>'enfantId'=m.data->>'enfantId'
    and a.data->>'periodeCle' ~ '^A:[0-9]{4}$' and m.data->>'periodeCle' ~ '^M:[0-9]{4}-(0[1-9]|1[0-2])$'
    and substring(a.data->>'periodeCle' from 3 for 4)=substring(m.data->>'periodeCle' from 3 for 4))
    then raise exception 'finance_legacy_period_overlap' using errcode='23505'; end if;
end $$;

create unique index rawdha_payment_child_period_unique on public.paiements ((data->>'enfantId'),(data->>'periodeCle')) where data ? 'periodeCle';

create function public.rawdha_finance_valid_date(p_date text)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
begin
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return to_char(p_date::date,'YYYY-MM-DD')=p_date;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end $$;

create function public.rawdha_write_invoice(p_action text, p_id text, p_patch jsonb, p_expected jsonb default null)
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
  -- Serializes all protected invoice writes for the child and locks ownership.
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
    -- Identical retry of an unchanged row is safe; never reuse an ID for another request.
    select data into v_current from public.paiements where id=p_id for update;
    if v_current is not null then
      if v_current=p_patch then return v_current || jsonb_build_object('id',p_id); end if;
      raise exception 'finance_request_id_conflict' using errcode='23505';
    end if;
    if exists (select 1 from public.paiements where data->>'enfantId'=v_child and not (data ? 'periodeCle')) then
      raise exception 'finance_legacy_review_required' using errcode='55000';
    end if;
    if exists (select 1 from public.paiements where data->>'enfantId'=v_child and (
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

revoke all on function public.rawdha_write_invoice(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.rawdha_write_invoice(text,text,jsonb,jsonb) to authenticated;
-- Delete is paused. Existing direct writes and old clients must not bypass locks.
revoke insert,update,delete on public.paiements from public,anon,authenticated;
commit;
