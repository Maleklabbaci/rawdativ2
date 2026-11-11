-- STAGING ONLY. Requires a reviewed, consistent dataset and a coordinated
-- client release. This migration makes old clients unable to mutate attendance.
-- It does not alter or deduplicate historical data.
begin;

-- Stabilize the data inspected by preflight until indexes and revocations exist.
-- This takes write-blocking locks; plan a maintenance window on staging first.
lock table public.enfants, public.presences, public.presence_journees in share row exclusive mode;

create or replace function public.rawdha_valid_attendance_date(p_date text)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
begin
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return to_char(p_date::date, 'YYYY-MM-DD') = p_date;
exception when invalid_datetime_format or datetime_field_overflow then
  return false;
end;
$$;

-- Stop instead of deleting or guessing old data. Audit and reconcile on staging
-- before considering a release; invalid dates/identities and duplicates block it.
do $$
begin
  if exists (select 1 from public.presences p where jsonb_typeof(p.data) is distinct from 'object'
    or jsonb_typeof(p.data->'enfantId') is distinct from 'string' or nullif(trim(p.data->>'enfantId'), '') is null
    or not public.rawdha_valid_attendance_date(p.data->>'date')) then
    raise exception 'attendance_legacy_invalid_rows' using errcode = '23514';
  end if;
  if exists (select 1 from public.presences group by data->>'enfantId', data->>'date' having count(*) > 1) then
    raise exception 'attendance_legacy_duplicates' using errcode = '23505';
  end if;
  if exists (select 1 from public.presences p where not exists (
    select 1 from public.enfants e where e.id = p.data->>'enfantId' and nullif(trim(e.data->>'crecheId'), '') is not null
  )) then raise exception 'attendance_legacy_orphan' using errcode = '23514'; end if;
  if exists (select 1 from public.presence_journees j where jsonb_typeof(j.data) is distinct from 'object'
    or jsonb_typeof(j.data->'crecheId') is distinct from 'string' or nullif(trim(j.data->>'crecheId'), '') is null
    or not public.rawdha_valid_attendance_date(j.data->>'date')
    or coalesce(j.data->>'statut', '') not in ('ouverte','validee')) then
    raise exception 'attendance_day_legacy_invalid_rows' using errcode = '23514';
  end if;
  if exists (select 1 from public.presence_journees group by data->>'crecheId', data->>'date' having count(*) > 1) then
    raise exception 'attendance_day_legacy_duplicates' using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists rawdha_presence_child_date_unique
  on public.presences ((data->>'enfantId'), (data->>'date'));
create unique index if not exists rawdha_presence_day_owner_date_unique
  on public.presence_journees ((data->>'crecheId'), (data->>'date'));

create or replace function public.rawdha_write_presence(
  p_action text, p_id text, p_patch jsonb default '{}'::jsonb, p_expected jsonb default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_before jsonb;
  v_current jsonb;
  v_next jsonb;
  v_child text;
  v_date text;
  v_owner text;
  v_child_data jsonb;
  v_day jsonb;
  v_arrival text;
  v_departure text;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(), false) or coalesce(public.rawdha_is_approved_director(), false)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('create','update','delete') or nullif(trim(p_id), '') is null or length(p_id) > 200
    or jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'invalid_attendance_request' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) as k where k not in (
    'enfantId','date','statut','heureArrivee','heureDepart','motifAbsence','temperature','repas','humeur',
    'personneRecuperation','personneRecuperationId','departVerifie','departVerifiePar','departVerifieLe'
  )) then raise exception 'invalid_attendance_field' using errcode = '22023'; end if;

  if p_action = 'create' then
    v_before := '{}'::jsonb;
    v_child := p_patch->>'enfantId';
    v_date := p_patch->>'date';
  else
    select data into v_before from public.presences where id = p_id;
    if v_before is null then raise exception 'attendance_not_found' using errcode = 'P0002'; end if;
    v_child := v_before->>'enfantId';
    v_date := v_before->>'date';
  end if;
  if nullif(trim(v_child), '') is null or not public.rawdha_valid_attendance_date(v_date) then
    raise exception 'invalid_attendance_identity' using errcode = '22023';
  end if;
  select data into v_child_data from public.enfants where id = v_child;
  v_owner := v_child_data->>'crecheId';
  if v_owner is null or (not coalesce(public.rawdha_is_admin(), false) and v_owner <> auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode = '42501';
  end if;

  -- Day changes and presence changes take exactly the same lock.
  perform pg_advisory_xact_lock(hashtext('rawdha_presence_day'), hashtext(v_owner || ':' || v_date));
  select data into v_child_data from public.enfants where id = v_child;
  if v_child_data is null or v_child_data->>'crecheId' is distinct from v_owner then
    raise exception 'attendance_child_changed' using errcode = '40001';
  end if;
  if p_action = 'create' and v_child_data->>'statut' is distinct from 'Actif' then
    raise exception 'attendance_child_inactive' using errcode = '22023';
  end if;
  if p_action <> 'create' then
    select data into v_current from public.presences where id = p_id for update;
    if v_current is null or v_current->>'enfantId' is distinct from v_child or v_current->>'date' is distinct from v_date then
      raise exception 'attendance_changed' using errcode = '40001';
    end if;
    if jsonb_typeof(p_expected) is distinct from 'object' or (p_expected - 'id') is distinct from (v_current - 'id') then
      raise exception 'attendance_changed' using errcode = '40001';
    end if;
  else
    v_current := '{}'::jsonb;
    if exists (select 1 from public.presences where data->>'enfantId' = v_child and data->>'date' = v_date) then
      raise exception 'attendance_already_exists' using errcode = '23505';
    end if;
  end if;
  select data into v_day from public.presence_journees where data->>'crecheId' = v_owner and data->>'date' = v_date;
  if p_action = 'delete' then
    if v_day->>'statut' = 'validee' then raise exception 'attendance_day_locked' using errcode = '55000'; end if;
    delete from public.presences where id = p_id;
    return jsonb_build_object('id', p_id);
  end if;

  v_next := v_current || p_patch;
  if v_next->>'enfantId' is distinct from v_child or v_next->>'date' is distinct from v_date then
    raise exception 'attendance_identity_change_forbidden' using errcode = '22023';
  end if;
  if coalesce(v_next->>'statut','') not in ('Présent','Absent justifié','Absent non justifié') then
    raise exception 'invalid_attendance_status' using errcode = '22023';
  end if;
  v_arrival := coalesce(v_next->>'heureArrivee','');
  v_departure := coalesce(v_next->>'heureDepart','');
  if v_next->>'statut' = 'Présent' and (v_arrival !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or (v_departure <> '' and (v_departure !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_departure <= v_arrival))) then
    raise exception 'invalid_attendance_times' using errcode = '22023';
  end if;
  -- Validation freezes the attendance decision, not later health and departure details.
  if v_day->>'statut' = 'validee' and (p_action = 'create'
    or v_next->>'statut' is distinct from v_current->>'statut'
    or v_next->>'heureArrivee' is distinct from v_current->>'heureArrivee'
    or v_next->>'motifAbsence' is distinct from v_current->>'motifAbsence') then
    raise exception 'attendance_day_locked' using errcode = '55000';
  end if;
  if p_action = 'create' then insert into public.presences(id,data) values (p_id,v_next);
  else update public.presences set data=v_next where id=p_id; end if;
  return v_next || jsonb_build_object('id',p_id);
end;
$$;

create or replace function public.rawdha_write_attendance_day(
  p_creche_id text, p_date text, p_status text, p_expected jsonb default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id text;
  v_current jsonb;
  v_next jsonb;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(), false) or coalesce(public.rawdha_is_approved_director(), false)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if nullif(trim(p_creche_id),'') is null or not public.rawdha_valid_attendance_date(p_date)
    or p_status is null or p_status not in ('ouverte','validee') then
    raise exception 'invalid_attendance_day_request' using errcode = '22023';
  end if;
  if not coalesce(public.rawdha_is_admin(), false) and p_creche_id <> auth.uid()::text then
    raise exception 'not_allowed_or_not_found' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('rawdha_presence_day'), hashtext(p_creche_id || ':' || p_date));
  select id,data into v_id,v_current from public.presence_journees
    where data->>'crecheId' = p_creche_id and data->>'date' = p_date for update;
  if v_current is null then
    if p_expected is not null then raise exception 'attendance_day_changed' using errcode = '40001'; end if;
    v_id := 'presence_day_' || p_creche_id || '_' || p_date;
  elsif jsonb_typeof(p_expected) is distinct from 'object' or (p_expected - 'id') is distinct from (v_current - 'id') then
    raise exception 'attendance_day_changed' using errcode = '40001';
  end if;
  if p_status = 'validee' then
    if not exists (select 1 from public.enfants e where e.data->>'crecheId' = p_creche_id and (e.data->>'statut' = 'Actif' or exists (
      select 1 from public.presences p where p.data->>'enfantId' = e.id and p.data->>'date' = p_date
    ))) or exists (
      select 1 from public.enfants e where e.data->>'crecheId' = p_creche_id and e.data->>'statut' = 'Actif'
      and not exists (select 1 from public.presences p where p.data->>'enfantId' = e.id and p.data->>'date' = p_date)
    ) or exists (
      select 1 from public.presences p join public.enfants e on e.id = p.data->>'enfantId'
      where e.data->>'crecheId' = p_creche_id and p.data->>'date' = p_date
      and coalesce(p.data->>'statut','') not in ('Présent','Absent justifié','Absent non justifié')
    ) then raise exception 'attendance_day_incomplete' using errcode = '22023'; end if;
    v_next := coalesce(v_current,'{}'::jsonb) || jsonb_build_object('crecheId',p_creche_id,'date',p_date,'statut','validee',
      'valideeLe',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'valideePar',auth.uid()::text);
  else
    v_next := (coalesce(v_current,'{}'::jsonb) - 'valideeLe' - 'valideePar') || jsonb_build_object('crecheId',p_creche_id,'date',p_date,'statut','ouverte');
  end if;
  if v_current is null then insert into public.presence_journees(id,data) values (v_id,v_next);
  else update public.presence_journees set data=v_next where id=v_id; end if;
  return v_next || jsonb_build_object('id',v_id);
end;
$$;

revoke all on function public.rawdha_write_presence(text,text,jsonb,jsonb) from public,anon;
revoke all on function public.rawdha_write_attendance_day(text,text,text,jsonb) from public,anon;
grant execute on function public.rawdha_write_presence(text,text,jsonb,jsonb) to authenticated;
grant execute on function public.rawdha_write_attendance_day(text,text,text,jsonb) to authenticated;
-- No insecure fallback: all application mutations must participate in the lock.
revoke insert,update,delete on public.presences,public.presence_journees from public,anon,authenticated;
commit;
