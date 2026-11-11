-- STAGING ONLY: install with the matching client, after reviewing existing
-- grants, child ownership and legal retention. No contacts are imported.
begin;

create table public.rawdha_pickup_authorizations (
  id text primary key,
  enfant_id text not null references public.enfants(id) on delete restrict,
  creche_id text not null,
  nom text not null,
  lien text not null,
  telephone text not null default '',
  reference_autorisation text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  check ((revoked_by is null) = (revoked_at is null))
);
create index rawdha_pickup_authorizations_child on public.rawdha_pickup_authorizations(enfant_id, created_at desc);
alter table public.rawdha_pickup_authorizations enable row level security;
revoke all on public.rawdha_pickup_authorizations from public, anon, authenticated;

-- One scoped read, with errors propagated rather than an ambiguous empty list.
create function public.rawdha_list_pickup_authorizations(p_child_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner text; v_result jsonb;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(), false) or coalesce(public.rawdha_is_approved_director(), false)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select e.data->>'crecheId' into v_owner from public.enfants e where e.id = p_child_id for share;
  if nullif(v_owner, '') is null or (not coalesce(public.rawdha_is_admin(), false) and v_owner <> auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'enfantId', a.enfant_id, 'nom', a.nom, 'lien', a.lien, 'telephone', a.telephone,
    'referenceAutorisation', a.reference_autorisation, 'createdBy', a.created_by, 'createdAt', a.created_at,
    'revokedBy', a.revoked_by, 'revokedAt', a.revoked_at
  ) order by a.created_at desc, a.id), '[]'::jsonb) into v_result
  from public.rawdha_pickup_authorizations a where a.enfant_id = p_child_id and a.creche_id = v_owner;
  return v_result;
end;
$$;

-- No edit or delete: corrections and renewals require revocation and a new entry.
-- Actor and timestamps are server-derived. A reference is a declaration, not
-- proof the authorizing guardian or identity was actually verified.
create function public.rawdha_write_pickup_authorization(
  p_action text, p_child_id text, p_id text,
  p_nom text default null, p_lien text default null, p_telephone text default null, p_reference text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner text; v_record public.rawdha_pickup_authorizations%rowtype;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(), false) or coalesce(public.rawdha_is_approved_director(), false)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('create','revoke') or nullif(trim(p_child_id),'') is null
    or nullif(trim(p_id),'') is null or length(p_id) > 200 then
    raise exception 'invalid_pickup_request' using errcode = '22023';
  end if;
  select e.data->>'crecheId' into v_owner from public.enfants e where e.id = p_child_id for share;
  if nullif(v_owner, '') is null or (not coalesce(public.rawdha_is_admin(), false) and v_owner <> auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode = '42501';
  end if;
  if p_action = 'create' then
    if nullif(trim(p_nom),'') is null or length(trim(p_nom)) > 200
      or nullif(trim(p_lien),'') is null or length(trim(p_lien)) > 100
      or length(coalesce(trim(p_telephone),'')) > 60
      or nullif(trim(p_reference),'') is null or length(trim(p_reference)) > 500 then
      raise exception 'invalid_pickup_details' using errcode = '22023';
    end if;
    insert into public.rawdha_pickup_authorizations(id,enfant_id,creche_id,nom,lien,telephone,reference_autorisation,created_by)
    values (p_id,p_child_id,v_owner,trim(p_nom),trim(p_lien),coalesce(trim(p_telephone),''),trim(p_reference),auth.uid()) returning * into v_record;
  else
    select * into v_record from public.rawdha_pickup_authorizations where id=p_id and enfant_id=p_child_id and creche_id=v_owner for update;
    if not found then raise exception 'pickup_not_found' using errcode = 'P0002'; end if;
    if v_record.revoked_at is not null then raise exception 'pickup_already_revoked' using errcode = '40001'; end if;
    update public.rawdha_pickup_authorizations set revoked_by=auth.uid(), revoked_at=now() where id=p_id returning * into v_record;
  end if;
  return jsonb_build_object('id',v_record.id,'enfantId',v_record.enfant_id,'nom',v_record.nom,'lien',v_record.lien,
    'telephone',v_record.telephone,'referenceAutorisation',v_record.reference_autorisation,'createdBy',v_record.created_by,
    'createdAt',v_record.created_at,'revokedBy',v_record.revoked_by,'revokedAt',v_record.revoked_at);
end;
$$;
revoke all on function public.rawdha_list_pickup_authorizations(text) from public, anon;
revoke all on function public.rawdha_write_pickup_authorization(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.rawdha_list_pickup_authorizations(text) to authenticated;
grant execute on function public.rawdha_write_pickup_authorization(text,text,text,text,text,text,text) to authenticated;
commit;
