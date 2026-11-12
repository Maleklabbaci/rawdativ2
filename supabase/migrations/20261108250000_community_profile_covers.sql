-- Public professional covers, isolated from private account data.
begin;
create table if not exists public.community_profile_covers (
  profile_id text primary key references public.comptes(id) on delete cascade,
  image_url text not null check (image_url ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' and length(image_url) <= 900000),
  updated_at timestamptz not null default now()
);
alter table public.community_profile_covers enable row level security;
revoke all on public.community_profile_covers from public, anon, authenticated;
grant select, insert, update, delete on public.community_profile_covers to authenticated;
drop policy if exists covers_read on public.community_profile_covers;
create policy covers_read on public.community_profile_covers for select to authenticated
  using (coalesce(public.rawdha_is_admin(), false) or coalesce(public.rawdha_is_approved_director(), false));
drop policy if exists covers_insert on public.community_profile_covers;
create policy covers_insert on public.community_profile_covers for insert to authenticated
  with check (profile_id = auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false));
drop policy if exists covers_update on public.community_profile_covers;
create policy covers_update on public.community_profile_covers for update to authenticated
  using (profile_id = auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false))
  with check (profile_id = auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false));
drop policy if exists covers_delete on public.community_profile_covers;
create policy covers_delete on public.community_profile_covers for delete to authenticated
  using (profile_id = auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false));
commit;
