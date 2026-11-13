-- The director chooses a parent already in the child record. The invitation is
-- a single-use secret and creates a pending request, never an approved link.
begin;
create table if not exists public.parent_invite_registered_identity (
 token_hash text primary key references public.parent_child_invites(token_hash) on delete cascade,
 parent_id text not null
);
alter table public.parent_invite_registered_identity enable row level security;
revoke all on public.parent_invite_registered_identity from public,anon,authenticated;

create or replace function public.rawdha_create_registered_parent_invite(p_enfant_id text,p_parent_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_child jsonb; v_parent jsonb; v_invite jsonb; v_token text;
begin
 if auth.uid() is null or not coalesce(public.rawdha_is_approved_director(),false) then raise exception 'director_required'; end if;
 select data into v_child from public.enfants where id=p_enfant_id and data->>'crecheId'=auth.uid()::text;
 if not found or jsonb_typeof(v_child->'parents') is distinct from 'array' then raise exception 'parent_unavailable'; end if;
 select p into v_parent from jsonb_array_elements(v_child->'parents') p where p->>'id'=p_parent_id limit 1;
 if v_parent is null or length(trim(coalesce(v_parent->>'prenom',''))) not between 1 and 100 or length(trim(coalesce(v_parent->>'nom',''))) not between 1 and 100 or length(trim(coalesce(v_parent->>'telephone',''))) not between 5 and 40 or coalesce(v_parent->>'lien','') not in ('Mère','Père','Tuteur') then raise exception 'parent_unavailable'; end if;
 v_invite := public.rawdha_create_child_parent_invite(p_enfant_id);
 v_token := v_invite->>'token';
 insert into public.parent_invite_registered_identity(token_hash,parent_id) values(encode(sha256(convert_to(v_token,'UTF8')),'hex'),p_parent_id);
 return v_invite;
end $$;

create or replace function public.rawdha_submit_registered_parent_invite(p_token text,p_device_token text,p_platform_hint text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_invite public.parent_child_invites%rowtype; v_parent_id text; v_child jsonb; v_parent jsonb;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_device_token is null or p_device_token !~ '^ptok_[0-9a-f]{32}$' or length(coalesce(p_platform_hint,''))>30 then raise exception 'invalid_input'; end if;
 select i.* into v_invite from public.parent_child_invites i join public.parent_invite_registered_identity r on r.token_hash=i.token_hash where i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and i.used_at is null and i.expires_at>now() for update of i;
 if not found then raise exception 'invite_invalide'; end if;
 select parent_id into v_parent_id from public.parent_invite_registered_identity where token_hash=v_invite.token_hash;
 select data into v_child from public.enfants where id=v_invite.child_id and data->>'crecheId'=v_invite.creche_id;
 if not found or jsonb_typeof(v_child->'parents') is distinct from 'array' then raise exception 'invite_invalide'; end if;
 select p into v_parent from jsonb_array_elements(v_child->'parents') p where p->>'id'=v_parent_id limit 1;
 if v_parent is null or coalesce(v_parent->>'lien','') not in ('Mère','Père','Tuteur') then raise exception 'invite_invalide'; end if;
 return public.rawdha_submit_child_parent_invite(p_token,p_device_token,v_parent->>'prenom',v_parent->>'nom',v_parent->>'telephone',v_parent->>'lien',p_platform_hint);
end $$;
revoke all on function public.rawdha_create_registered_parent_invite(text,text) from public,anon,authenticated;
grant execute on function public.rawdha_create_registered_parent_invite(text,text) to authenticated;
revoke all on function public.rawdha_submit_registered_parent_invite(text,text,text) from public,anon,authenticated;
grant execute on function public.rawdha_submit_registered_parent_invite(text,text,text) to anon,authenticated;
commit;
