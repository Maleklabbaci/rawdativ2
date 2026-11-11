-- STAGING ONLY. Requires reviewed account approval and attendance-date functions.
-- Sensitive information: verify access, retention, hosting and backup on staging.
-- Stop rather than hide or overwrite a previously deployed PR health journal.
begin;
do $$ begin
  if to_regclass('public.sante_evenements') is not null then
    raise exception 'health_legacy_table_requires_review' using errcode = '55000';
  end if;
end $$;

create table public.rawdha_child_health_events (
  id text primary key,
  enfant_id text not null references public.enfants(id) on delete restrict,
  creche_id text not null,
  event_type text not null,
  event_date text not null,
  event_time text,
  details jsonb not null,
  corrects_id text references public.rawdha_child_health_events(id) on delete restrict,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp()
);
create index rawdha_child_health_events_child on public.rawdha_child_health_events(enfant_id,creche_id,created_at desc,id);
alter table public.rawdha_child_health_events enable row level security;
revoke all on public.rawdha_child_health_events from public, anon, authenticated;

-- Only the approved director who owns the child is authorized here; no global
-- admin, pending account, anonymous, parent or staff access is implied.
create function public.rawdha_list_child_health_events(p_child_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner text; v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.rawdha_is_approved_director(),false) then
    raise exception 'health_not_allowed' using errcode = '42501';
  end if;
  select data->>'crecheId' into v_owner from public.enfants where id=p_child_id for share;
  if v_owner is distinct from auth.uid()::text then
    raise exception 'health_not_allowed_or_not_found' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'enfantId',e.enfant_id,'type',e.event_type,'date',e.event_date,'heure',e.event_time,
    'details',e.details,'correctsId',e.corrects_id,'createdBy',e.created_by,'createdAt',e.created_at
  ) order by e.created_at desc,e.id), '[]'::jsonb) into v_result
  from public.rawdha_child_health_events e where e.enfant_id=p_child_id and e.creche_id=v_owner;
  return v_result;
end;
$$;

-- Appending a correction references an earlier entry; nothing is erased. The
-- server records who made the entry and when, not the client's claimed actor.
create function public.rawdha_add_child_health_event(
  p_id text, p_child_id text, p_type text, p_date text, p_time text,
  p_details jsonb, p_corrects_id text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner text; v_entry public.rawdha_child_health_events%rowtype; v_key text; v_allowed text[];
begin
  if auth.uid() is null or not coalesce(public.rawdha_is_approved_director(),false) then
    raise exception 'health_not_allowed' using errcode = '42501';
  end if;
  if nullif(trim(p_id),'') is null or length(p_id)>200 or nullif(trim(p_child_id),'') is null
    or p_type is null or p_type not in ('medicament','incident','soin','visite_medicale','visite_psychologique','rappel_medical','correction')
    or not public.rawdha_valid_attendance_date(p_date)
    or (nullif(p_time,'') is not null and p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    or jsonb_typeof(p_details) is distinct from 'object' then
    raise exception 'health_invalid_request' using errcode = '22023';
  end if;
  select data->>'crecheId' into v_owner from public.enfants where id=p_child_id for share;
  if v_owner is distinct from auth.uid()::text then
    raise exception 'health_not_allowed_or_not_found' using errcode = '42501';
  end if;
  v_allowed := case p_type
    when 'medicament' then array['description','medicament','dose','ordonnance','administrePar']
    when 'incident' then array['description','gravite','localisation','soinsDonnes','parentsAvertis']
    when 'soin' then array['description','soinsDonnes','parentsAvertis']
    when 'visite_medicale' then array['description','praticien']
    when 'visite_psychologique' then array['description','praticien']
    else array['description'] end;
  for v_key in select jsonb_object_keys(p_details) loop
    if not (v_key = any(v_allowed)) or jsonb_typeof(p_details->v_key) is distinct from 'string'
      or length(p_details->>v_key)>2000 then
      raise exception 'health_invalid_details' using errcode = '22023';
    end if;
  end loop;
  if nullif(trim(p_details->>'description'),'') is null
    or (p_type='medicament' and nullif(trim(p_details->>'medicament'),'') is null) then
    raise exception 'health_invalid_details' using errcode = '22023';
  end if;
  if p_type='correction' then
    if nullif(trim(p_corrects_id),'') is null or not exists (
      select 1 from public.rawdha_child_health_events where id=p_corrects_id and enfant_id=p_child_id and creche_id=v_owner
    ) then raise exception 'health_invalid_correction' using errcode = '22023'; end if;
  elsif p_corrects_id is not null then
    raise exception 'health_invalid_correction' using errcode = '22023';
  end if;
  insert into public.rawdha_child_health_events(id,enfant_id,creche_id,event_type,event_date,event_time,details,corrects_id,created_by)
  values(p_id,p_child_id,v_owner,p_type,p_date,nullif(p_time,''),p_details,p_corrects_id,auth.uid())
  on conflict (id) do nothing returning * into v_entry;
  if not found then
    select * into v_entry from public.rawdha_child_health_events where id=p_id;
    if not found or v_entry.enfant_id is distinct from p_child_id or v_entry.creche_id is distinct from v_owner
      or v_entry.created_by is distinct from auth.uid() or v_entry.event_type is distinct from p_type
      or v_entry.event_date is distinct from p_date or v_entry.event_time is distinct from nullif(p_time,'')
      or v_entry.details is distinct from p_details or v_entry.corrects_id is distinct from p_corrects_id then
      raise exception 'health_request_id_conflict' using errcode = '23505';
    end if;
  end if;
  return jsonb_build_object('id',v_entry.id,'enfantId',v_entry.enfant_id,'type',v_entry.event_type,'date',v_entry.event_date,
    'heure',v_entry.event_time,'details',v_entry.details,'correctsId',v_entry.corrects_id,'createdBy',v_entry.created_by,'createdAt',v_entry.created_at);
end;
$$;
revoke all on function public.rawdha_list_child_health_events(text) from public,anon;
revoke all on function public.rawdha_add_child_health_event(text,text,text,text,text,jsonb,text) from public,anon;
grant execute on function public.rawdha_list_child_health_events(text) to authenticated;
grant execute on function public.rawdha_add_child_health_event(text,text,text,text,text,jsonb,text) to authenticated;
commit;
