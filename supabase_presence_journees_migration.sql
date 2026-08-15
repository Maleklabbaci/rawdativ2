-- RAWDHA+ — Présence : validation de journée
-- Migration additive et non destructive.
-- Elle ajoute une table dédiée sans modifier ni supprimer les données existantes.

create table if not exists public.presence_journees (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.presence_journees enable row level security;

drop policy if exists "allow all presence_journees" on public.presence_journees;
drop policy if exists "presence_journees_select" on public.presence_journees;
drop policy if exists "presence_journees_insert" on public.presence_journees;
drop policy if exists "presence_journees_update" on public.presence_journees;
drop policy if exists "presence_journees_delete" on public.presence_journees;

create policy "presence_journees_select" on public.presence_journees
  for select
  using (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  );

create policy "presence_journees_insert" on public.presence_journees
  for insert
  with check (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  );

create policy "presence_journees_update" on public.presence_journees
  for update
  using (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  )
  with check (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  );

create policy "presence_journees_delete" on public.presence_journees
  for delete
  using (
    public.rawdha_is_admin()
    or (data->>'crecheId') = auth.uid()::text
  );

comment on table public.presence_journees is 'État de validation quotidien du registre des présences Rawdha+';
comment on column public.presence_journees.data is 'crecheId, date, statut, valideeLe et valideePar';
