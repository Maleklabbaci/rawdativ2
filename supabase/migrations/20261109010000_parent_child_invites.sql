-- A personal, single-use invitation creates a PENDING request; it never grants access.
begin;
alter table public.parent_link_requests add column if not exists requested_child_id text;
create table if not exists public.parent_child_invites (
  token_hash text primary key,
  creche_id text not null,
  child_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.parent_child_invites enable row level security;
revoke all on public.parent_child_invites from public, anon, authenticated;

create or replace function public.rawdha_parent_invite_clear_selection()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.requested_children is distinct from old.requested_children then
    new.requested_child_id := null;
  end if;
  return new;
end $$;
drop trigger if exists rawdha_parent_invite_clear_selection on public.parent_link_requests;
create trigger rawdha_parent_invite_clear_selection before update on public.parent_link_requests
for each row execute function public.rawdha_parent_invite_clear_selection();

create or replace function public.rawdha_create_child_parent_invite(p_enfant_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_token text; v_expires timestamptz := now() + interval '48 hours';
begin
  if auth.uid() is null or not coalesce(public.rawdha_is_approved_director(),false) then raise exception 'director_required'; end if;
  if not exists (select 1 from public.enfants e where e.id=p_enfant_id and e.data->>'crecheId'=auth.uid()::text) then raise exception 'child_not_found'; end if;
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into public.parent_child_invites(token_hash,creche_id,child_id,expires_at)
  values (encode(sha256(convert_to(v_token,'UTF8')),'hex'),auth.uid()::text,p_enfant_id,v_expires);
  return jsonb_build_object('token',v_token,'expiresAt',v_expires);
end $$;
revoke all on function public.rawdha_create_child_parent_invite(text) from public,anon,authenticated;
grant execute on function public.rawdha_create_child_parent_invite(text) to authenticated;

create or replace function public.rawdha_submit_child_parent_invite(
 p_token text,p_device_token text,p_parent_prenom text,p_parent_nom text,p_parent_telephone text,p_parent_lien text,p_platform_hint text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_invite public.parent_child_invites%rowtype; v_child jsonb; v_result jsonb; v_existing public.parent_link_requests%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_device_token is null or p_device_token !~ '^ptok_[0-9a-f]{32}$'
    or length(trim(coalesce(p_parent_prenom,''))) not between 1 and 100
    or length(trim(coalesce(p_parent_nom,''))) not between 1 and 100
    or length(trim(coalesce(p_parent_telephone,''))) not between 5 and 40
    or length(coalesce(p_parent_lien,'')) > 50 or length(coalesce(p_platform_hint,'')) > 30 then raise exception 'invalid_input'; end if;
  select * into v_invite from public.parent_child_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and used_at is null and expires_at>now() for update;
  if not found or not exists (select 1 from public.comptes c where c.id=v_invite.creche_id and c.data->>'role'='directeur' and c.data->>'approvalStatus'='approved') then raise exception 'invite_invalide'; end if;
  select data into v_child from public.enfants where id=v_invite.child_id and data->>'crecheId'=v_invite.creche_id;
  if not found then raise exception 'invite_invalide'; end if;
  select * into v_existing from public.parent_link_requests where creche_id=v_invite.creche_id and device_token_hash=encode(sha256(convert_to(p_device_token,'UTF8')),'hex') for update;
  if found and (cardinality(v_existing.linked_enfant_ids)>0 or v_existing.status='pending') then raise exception 'existing_request_contact_director'; end if;
  v_result := public.submit_parent_link_request(v_invite.creche_id,'',p_device_token,p_parent_prenom,p_parent_nom,p_parent_telephone,p_parent_lien,
    jsonb_build_array(jsonb_build_object('prenom','Enfant invité','nom','','groupeAge','')),p_platform_hint);
  update public.parent_link_requests set requested_child_id=v_invite.child_id where id=v_result->>'id';
  update public.parent_child_invites set used_at=now() where token_hash=v_invite.token_hash;
  return v_result;
end $$;
revoke all on function public.rawdha_submit_child_parent_invite(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.rawdha_submit_child_parent_invite(text,text,text,text,text,text,text) to anon,authenticated;
commit;
