-- RAWDHA+ — File de demandes d’inscription directeur
-- Les visiteurs peuvent uniquement déposer une demande en attente.
-- Seul un administrateur authentifié peut consulter, accepter, refuser ou supprimer une demande.

create table if not exists public.demandes_directeur (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.demandes_directeur enable row level security;

drop policy if exists "allow all demandes_directeur" on public.demandes_directeur;
drop policy if exists "demandes_directeur_public_insert" on public.demandes_directeur;
drop policy if exists "demandes_directeur_admin_select" on public.demandes_directeur;
drop policy if exists "demandes_directeur_admin_update" on public.demandes_directeur;
drop policy if exists "demandes_directeur_admin_delete" on public.demandes_directeur;

create policy "demandes_directeur_public_insert"
on public.demandes_directeur
for insert
to anon, authenticated
with check (
  coalesce(data->>'statut', 'en_attente') = 'en_attente'
);

create policy "demandes_directeur_admin_select"
on public.demandes_directeur
for select
to authenticated
using (public.rawdha_is_admin());

create policy "demandes_directeur_admin_update"
on public.demandes_directeur
for update
to authenticated
using (public.rawdha_is_admin())
with check (public.rawdha_is_admin());

create policy "demandes_directeur_admin_delete"
on public.demandes_directeur
for delete
to authenticated
using (public.rawdha_is_admin());

revoke select, update, delete on public.demandes_directeur from anon;
grant insert on public.demandes_directeur to anon, authenticated;
grant select, update, delete on public.demandes_directeur to authenticated;

comment on table public.demandes_directeur is 'Demandes publiques d’accès directeur, traitées exclusivement par l’administrateur Rawdha+.';
comment on column public.demandes_directeur.data is 'JSONB contenant les informations de la crèche et le statut en_attente/acceptee/refusee.';

-- Vérification attendue après exécution :
-- 1) une insertion anonyme avec statut en_attente est autorisée ;
-- 2) la lecture anonyme est refusée ;
-- 3) un admin authentifié voit et modifie les demandes ;
-- 4) un directeur authentifié ne voit aucune demande.

-- Important : cette migration ne modifie aucune ligne métier existante.
-- Elle doit être exécutée dans Supabase SQL Editor avant la mise en production du formulaire public.

-- Désactivation de la confirmation e-mail : à régler dans Supabase Dashboard > Authentication > Providers > Email.
-- Le flux admin utilise déjà l’Edge Function create-account et ne dépend pas de cette option.
