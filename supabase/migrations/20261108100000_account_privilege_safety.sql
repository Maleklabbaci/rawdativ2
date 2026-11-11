-- P0: protect account roles, approvals and subscriptions from self-modification.
-- Staging only until the current policies, privileged RPCs, signup triggers and
-- service-role workflows have been audited. This migration is NOT deployed.
begin;

-- This policy is parsed before the later explicit-approval migration. Define
-- the same fail-closed helper here rather than depending on an optional legacy
-- compatibility script that could infer approval from user metadata.
create or replace function public.rawdha_is_approved_director()
returns boolean language sql security definer stable set search_path = public, pg_temp
as $$
  select exists (select 1 from public.comptes c where c.id = auth.uid()::text
    and c.data->>'role' = 'directeur' and c.data->>'approvalStatus' = 'approved')
$$;
revoke all on function public.rawdha_is_approved_director() from public, anon;
grant execute on function public.rawdha_is_approved_director() to authenticated;

-- The profile is JSONB, so row-level policies alone cannot limit which keys an
-- owner changes. Keep unknown/new keys protected by default, not just a list of
-- sensitive keys. SECURITY INVOKER is intentional: writes issued by an audited
-- SECURITY DEFINER function execute as its owner, whereas PostgREST writes run
-- as anon/authenticated. Those privileged server paths need separate review.
create or replace function public.rawdha_guard_account_client_write()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Account creation and deletion already use trusted server-side workflows.
  if tg_op <> 'UPDATE' or current_user <> 'authenticated' or auth.uid() is null then
    raise exception 'account_client_write_forbidden' using errcode = '42501';
  end if;
  if coalesce(public.rawdha_is_admin(), false) then return new; end if;
  if old.id is distinct from auth.uid()::text or new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
     or not coalesce(public.rawdha_is_approved_director(), false) then
    raise exception 'account_client_write_forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(new.data) is distinct from 'object' or
     (new.data - array['nom','prenom','telephone','ville','bio','avatarUrl','logoUrl','siteWeb','specialites','horaires','services','nomCreche','classesCount','lastActivityAt'])
       is distinct from
     (old.data - array['nom','prenom','telephone','ville','bio','avatarUrl','logoUrl','siteWeb','specialites','horaires','services','nomCreche','classesCount','lastActivityAt']) then
    raise exception 'account_privileged_fields_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.rawdha_guard_account_client_write() from public, anon, authenticated;
drop trigger if exists rawdha_account_client_write_guard on public.comptes;
create trigger rawdha_account_client_write_guard
before insert or update or delete on public.comptes
for each row execute function public.rawdha_guard_account_client_write();

-- Policies are permissive (ORed) by default, so leaving an old permissive
-- policy in place defeats isolation. Replace all account policies atomically.
alter table public.comptes enable row level security;
do $$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'comptes' loop
    execute format('drop policy %I on public.comptes', policy_row.policyname);
  end loop;
end;
$$;

revoke all on table public.comptes from public, anon, authenticated;
grant select, update on public.comptes to authenticated;
create policy comptes_select on public.comptes for select to authenticated
  using (auth.uid() is not null and (coalesce(public.rawdha_is_admin(), false) or id = auth.uid()::text));
create policy comptes_update on public.comptes for update to authenticated
  using (auth.uid() is not null and (coalesce(public.rawdha_is_admin(), false) or (id = auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false))))
  with check (auth.uid() is not null and (coalesce(public.rawdha_is_admin(), false) or (id = auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false))));
commit;
