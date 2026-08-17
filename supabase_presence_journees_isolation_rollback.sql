-- Rawdha+ — Rollback du correctif presence_journees
-- À utiliser uniquement pour annuler le correctif après diagnostic.
-- Il restaure les policies authenticated constatées avant le durcissement.

revoke all on table public.presence_journees from anon;

drop policy if exists "presence_journees_select" on public.presence_journees;
drop policy if exists "presence_journees_insert" on public.presence_journees;
drop policy if exists "presence_journees_update" on public.presence_journees;
drop policy if exists "presence_journees_delete" on public.presence_journees;
drop policy if exists "Enable read access for all users" on public.presence_journees;

create policy "Enable read access for all users" on public.presence_journees
  for select to authenticated
  using (true);

create policy "presence_journees_insert" on public.presence_journees
  for insert to authenticated
  with check (true);

create policy "presence_journees_update" on public.presence_journees
  for update to authenticated
  using (true)
  with check (true);
