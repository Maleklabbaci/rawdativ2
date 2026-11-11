-- Class mutations are serialized per crèche. Apply only together with the matching
-- client and after validating existing RLS and data on a staging project.
begin;

create or replace function public.rawdha_write_classe(p_action text, p_id text, p_patch jsonb default '{}'::jsonb, p_expected_children jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner text;
  v_old jsonb;
  v_next jsonb;
  v_children jsonb;
  v_old_children jsonb;
  v_child text;
  v_capacity integer;
  v_count integer;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(), false) or coalesce(public.rawdha_is_approved_director(), false)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('create', 'update', 'delete') or p_id is null or length(trim(p_id)) = 0 or length(p_id) > 200 or jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'invalid_class_request' using errcode = '22023';
  end if;
  if p_action = 'create' then
    v_owner := nullif(p_patch->>'crecheId', '');
  else
    select data->>'crecheId' into v_owner from public.classes where id = p_id;
  end if;
  if v_owner is null or (not coalesce(public.rawdha_is_admin(), false) and v_owner <> auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode = '42501';
  end if;

  -- Take the same lock for every class mutation before locking any class row.
  perform pg_advisory_xact_lock(hashtext('rawdha_classes'), hashtext(v_owner));
  if p_action <> 'create' then
    select data into v_old from public.classes where id = p_id for update;
    if v_old is null or v_old->>'crecheId' is distinct from v_owner then
      raise exception 'class_not_found' using errcode = 'P0002';
    end if;
  else
    v_old := '{}'::jsonb;
  end if;
  if p_action = 'delete' then
    delete from public.classes where id = p_id;
    return jsonb_build_object('id', p_id);
  end if;

  -- A stale browser must not replace a list modified by another device.
  if p_action = 'update' and p_patch ? 'childrenIds' then
    if jsonb_typeof(p_expected_children) is distinct from 'array' or
       p_expected_children is distinct from coalesce(v_old->'childrenIds', '[]'::jsonb) then
      raise exception 'class_membership_changed' using errcode = '40001';
    end if;
  end if;

  -- Only the fields managed by the class editor may be changed.
  if exists (select 1 from jsonb_object_keys(p_patch) as k where k not in ('nom','niveau','capacite','educateurChef','salleNom','couleurTheme','childrenIds','crecheId')) then
    raise exception 'invalid_class_field' using errcode = '22023';
  end if;
  if p_patch ? 'crecheId' and p_patch->>'crecheId' is distinct from v_owner then
    raise exception 'class_owner_change_forbidden' using errcode = '42501';
  end if;
  v_next := v_old || p_patch || jsonb_build_object('crecheId', v_owner);
  if nullif(trim(v_next->>'nom'), '') is null or coalesce(v_next->>'niveau', '') not in ('Bébés', 'Moyens', 'Grands') then
    raise exception 'invalid_class_details' using errcode = '22023';
  end if;
  begin
    v_capacity := (v_next->>'capacite')::integer;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'invalid_class_capacity' using errcode = '22023';
  end;
  if v_capacity is null or v_capacity < 1 then
    raise exception 'invalid_class_capacity' using errcode = '22023';
  end if;
  v_children := coalesce(v_next->'childrenIds', '[]'::jsonb);
  v_old_children := coalesce(v_old->'childrenIds', '[]'::jsonb);
  if jsonb_typeof(v_children) is distinct from 'array' or jsonb_typeof(v_old_children) is distinct from 'array' then
    raise exception 'invalid_class_children' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_children) item where jsonb_typeof(item) <> 'string' or length(trim(item #>> '{}')) = 0) then
    raise exception 'invalid_class_children' using errcode = '22023';
  end if;
  select count(*), count(distinct value) into v_count, v_capacity from jsonb_array_elements_text(v_children);
  if (p_action = 'create' or p_patch ? 'childrenIds') and v_count <> v_capacity then raise exception 'duplicate_class_children' using errcode = '22023'; end if;
  v_capacity := (v_next->>'capacite')::integer;
  if (p_action = 'create' or p_patch ? 'capacite' or p_patch ? 'childrenIds') and v_count > v_capacity then
    raise exception 'class_capacity_exceeded' using errcode = '22023';
  end if;

  -- Validate additions only, so old problems can still be removed or repaired.
  for v_child in select value from jsonb_array_elements_text(v_children) where not (v_old_children ? value) loop
    if not exists (select 1 from public.enfants e where e.id = v_child and e.data->>'crecheId' = v_owner and e.data->>'statut' = 'Actif') then
      raise exception 'invalid_or_inactive_child' using errcode = '22023';
    end if;
    if exists (select 1 from public.classes c where c.id <> p_id and c.data->>'crecheId' = v_owner and coalesce(c.data->'childrenIds', '[]'::jsonb) ? v_child) then
      raise exception 'child_already_assigned' using errcode = '22023';
    end if;
  end loop;
  if p_action = 'create' then
    insert into public.classes(id, data) values (p_id, v_next);
  else
    update public.classes set data = v_next where id = p_id;
  end if;
  return v_next || jsonb_build_object('id', p_id);
end;
$$;

revoke all on function public.rawdha_write_classe(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.rawdha_write_classe(text, text, jsonb, jsonb) to authenticated;
-- The RPC checks ownership and ensures every browser write uses the same lock.
revoke insert, update, delete on public.classes from public, anon, authenticated;
commit;
