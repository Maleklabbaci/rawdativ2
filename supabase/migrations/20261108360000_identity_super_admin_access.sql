-- Explicit server-managed allowlist for access to sensitive identity reviews.
-- Intentionally empty on installation; provision a verified administrator out-of-band.
begin;
create table if not exists public.identity_super_admins (
  account_id text primary key references public.comptes(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.identity_super_admins enable row level security;
revoke all on public.identity_super_admins from public, anon, authenticated, service_role;

-- Only the service role may ask about an arbitrary actor (Edge verifies the JWT).
create or replace function public.rawdha_identity_is_super_admin(p_account_id text)
returns boolean language sql security definer stable set search_path=public,pg_temp as $$
  select exists (select 1 from public.identity_super_admins a join public.comptes c on c.id=a.account_id
    where a.account_id=p_account_id and c.data->>'role'='admin')
$$;
revoke all on function public.rawdha_identity_is_super_admin(text) from public,anon,authenticated;
grant execute on function public.rawdha_identity_is_super_admin(text) to service_role;

-- RLS can only check the caller's own identity, never an arbitrary actor.
create or replace function public.rawdha_identity_caller_is_super_admin()
returns boolean language sql security definer stable set search_path=public,pg_temp as $$
  select public.rawdha_identity_is_super_admin(auth.uid()::text)
$$;
revoke all on function public.rawdha_identity_caller_is_super_admin() from public,anon;
grant execute on function public.rawdha_identity_caller_is_super_admin() to authenticated;
drop policy if exists identity_review_read on public.identity_document_reviews;
create policy identity_review_read on public.identity_document_reviews for select to authenticated
  using (account_id=auth.uid()::text or public.rawdha_identity_caller_is_super_admin());

-- Defense in depth: even service-level decision RPCs cannot decide for an
-- unlisted actor. Lock the grant so revocation cannot race a committing decision.
create or replace function public.rawdha_identity_require_super_admin_decision()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.status='pending' and new.status in ('document_reviewed','refused') then
    perform 1 from public.identity_super_admins a join public.comptes c on c.id=a.account_id
      where a.account_id=new.decided_by and c.data->>'role'='admin' for share of a, c;
    if not found then raise exception 'super_admin_required'; end if;
  end if;
  return new;
end $$;
revoke all on function public.rawdha_identity_require_super_admin_decision() from public,anon,authenticated,service_role;
drop trigger if exists rawdha_identity_require_super_admin on public.identity_document_reviews;
create trigger rawdha_identity_require_super_admin before update of status, decided_by on public.identity_document_reviews
  for each row execute function public.rawdha_identity_require_super_admin_decision();
commit;
