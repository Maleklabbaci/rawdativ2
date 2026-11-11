-- STAGING ONLY. Requires the attendance and pickup-registry migrations plus the
-- matching client. New departures require an explicit active registry entry;
-- existing departures are preserved. Coordinate rollout and rollback.
begin;

-- Keep the original attendance implementation private. The public wrapper
-- rejects attempts to forge the verification fields, including from old clients.
alter function public.rawdha_write_presence(text,text,jsonb,jsonb) rename to rawdha_write_presence_internal;
revoke all on function public.rawdha_write_presence_internal(text,text,jsonb,jsonb) from public, anon, authenticated;

create function public.rawdha_write_presence(
  p_action text, p_id text, p_patch jsonb default '{}'::jsonb, p_expected jsonb default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_patch jsonb := p_patch; v_key text;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'invalid_attendance_request' using errcode = '22023';
  end if;
  if p_patch->>'departVerifie' = 'true' or nullif(p_patch->>'departVerifiePar','') is not null
     or nullif(p_patch->>'departVerifieLe','') is not null then
    raise exception 'pickup_confirmation_requires_registry' using errcode = '42501';
  end if;
  -- Any change to material departure fields invalidates the prior attestation.
  -- The underlying function checks that p_expected is the exact current row.
  if p_action = 'update' then
    foreach v_key in array array['statut','heureArrivee','heureDepart','personneRecuperation','personneRecuperationId'] loop
      if p_patch ? v_key and p_patch->>v_key is distinct from p_expected->>v_key then
        v_patch := v_patch || jsonb_build_object('departVerifie',false,'departVerifiePar','','departVerifieLe','','personneRecuperationId','');
        exit;
      end if;
    end loop;
  end if;
  return public.rawdha_write_presence_internal(p_action,p_id,v_patch,p_expected);
end;
$$;

-- Lock the child then the authorization, the same order as revocation. A revoke
-- that commits first blocks this confirmation; a later revoke retains the past
-- departure. The attendance function takes its day and presence locks afterwards.
create function public.rawdha_confirm_pickup_departure(
  p_presence_id text, p_expected jsonb, p_authorization_id text,
  p_departure_time text, p_identity_checked boolean
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_presence jsonb; v_child text; v_owner text; v_authorization public.rawdha_pickup_authorizations%rowtype;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_identity_checked is distinct from true or nullif(trim(p_authorization_id),'') is null then
    raise exception 'pickup_check_required' using errcode = '22023';
  end if;
  select data into v_presence from public.presences where id=p_presence_id;
  if v_presence is null then raise exception 'attendance_not_found' using errcode = 'P0002'; end if;
  v_child := v_presence->>'enfantId';
  select data->>'crecheId' into v_owner from public.enfants where id=v_child for share;
  if nullif(v_owner,'') is null or (not coalesce(public.rawdha_is_admin(),false) and v_owner <> auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode = '42501';
  end if;
  select * into v_authorization from public.rawdha_pickup_authorizations
    where id=p_authorization_id and enfant_id=v_child and creche_id=v_owner for share;
  if not found or v_authorization.revoked_at is not null then
    raise exception 'pickup_authorization_inactive' using errcode = '55000';
  end if;
  if p_departure_time is null or p_departure_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'invalid_attendance_times' using errcode = '22023';
  end if;
  if v_presence->>'statut' is distinct from 'Présent' or v_presence->>'departVerifie' = 'true' then
    raise exception 'pickup_presence_invalid' using errcode = '55000';
  end if;
  if nullif(trim(v_presence->>'personneRecuperation'),'') is not null and trim(v_presence->>'personneRecuperation') <> v_authorization.nom then
    raise exception 'pickup_name_conflict' using errcode = '55000';
  end if;
  return public.rawdha_write_presence_internal('update',p_presence_id,jsonb_build_object(
    'heureDepart',p_departure_time,'personneRecuperation',v_authorization.nom,'personneRecuperationId','registry-' || v_authorization.id,
    'departVerifie',true,'departVerifiePar',auth.uid()::text,
    'departVerifieLe',to_char(clock_timestamp() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ),p_expected);
end;
$$;

revoke all on function public.rawdha_write_presence(text,text,jsonb,jsonb) from public,anon;
revoke all on function public.rawdha_confirm_pickup_departure(text,jsonb,text,text,boolean) from public,anon;
grant execute on function public.rawdha_write_presence(text,text,jsonb,jsonb) to authenticated;
grant execute on function public.rawdha_confirm_pickup_departure(text,jsonb,text,text,boolean) to authenticated;
commit;
