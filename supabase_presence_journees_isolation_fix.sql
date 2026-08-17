-- Rawdha+ — Correctif P0 d'isolation multi-tenant pour les journées de présence
-- Non destructif : remplace uniquement les policies permissives.
-- Les rôles publics ne reçoivent aucun accès direct à cette table.

alter table public.presence_journees enable row level security;

revoke all on table public.presence_journees from anon;

drop policy if exists "Enable read access for all users" on public.presence_journees;
drop policy if exists "presence_journees_select" on public.presence_journees;
drop policy if exists "presence_journees_insert" on public.presence_journees;
drop policy if exists "presence_journees_update" on public.presence_journees;
drop policy if exists "presence_journees_delete" on public.presence_journees;

create policy "presence_journees_select" on public.presence_journees
  for select to authenticated
  using (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  );

create policy "presence_journees_insert" on public.presence_journees
  for insert to authenticated
  with check (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  );

create policy "presence_journees_update" on public.presence_journees
  for update to authenticated
  using (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  )
  with check (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  );

create policy "presence_journees_delete" on public.presence_journees
  for delete to authenticated
  using (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  );
