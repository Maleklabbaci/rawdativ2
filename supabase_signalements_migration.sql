-- Rawdha+ — Signalements et suggestions utilisateurs
-- Une ligne JSONB par retour, comme les autres collections de l'application.

create table if not exists public.signalements (
  id text primary key,
  data jsonb not null default '{}'::jsonb
);

alter table public.signalements enable row level security;

-- Rejouable sans laisser d'anciennes policies plus permissives actives.
drop policy if exists "allow all signalements" on public.signalements;
drop policy if exists "signalements_select" on public.signalements;
drop policy if exists "signalements_insert" on public.signalements;
drop policy if exists "signalements_update" on public.signalements;
drop policy if exists "signalements_delete" on public.signalements;

-- Un utilisateur connecté lit uniquement ses propres retours ; l'admin lit tout.
create policy "signalements_select"
on public.signalements
for select
to authenticated
using (
  public.rawdha_is_admin()
  or (data->>'userId') = auth.uid()::text
);

-- Le userId de la ligne doit correspondre à la session qui l'envoie.
create policy "signalements_insert"
on public.signalements
for insert
to authenticated
with check (
  (data->>'userId') = auth.uid()::text
);

-- Seul l'administrateur peut répondre, changer le statut ou supprimer après confirmation.
create policy "signalements_update"
on public.signalements
for update
to authenticated
using (public.rawdha_is_admin())
with check (public.rawdha_is_admin());

create policy "signalements_delete"
on public.signalements
for delete
to authenticated
using (public.rawdha_is_admin());

revoke all on public.signalements from anon;
grant select, insert, update, delete on public.signalements to authenticated;

comment on table public.signalements is 'Retours utilisateurs Rawdha+: bugs, problèmes, suggestions et améliorations.';
comment on column public.signalements.data is 'Signalement JSONB : userId, userName, nomCreche, type, titre, description, statut, date, reponseAdmin.';
