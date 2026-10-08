-- Module Santé Rawdha+ — registre de suivi médical des enfants.
--
-- Couvre les obligations de suivi du décret :
--   * registre de prise de médicaments ;
--   * fiche d'incidents et de soins ;
--   * visites du médecin et du psychologue de la crèche ;
--   * rappel des échéances (certificat d'aptitude, vaccins de rappel).
--
-- Migration strictement additive : aucune table ni donnée existante n'est
-- supprimée ou modifiée.
--
-- Le rattachement se fait par `enfantId`, exactement comme pour `presences`.
-- Le périmètre de crèche est déduit de la fiche enfant : on évite ainsi de
-- dupliquer `crecheId` dans chaque événement, où il finirait par diverger.
--
-- À coller dans Supabase Dashboard -> SQL Editor -> New query -> Run.

begin;

create table if not exists public.sante_evenements (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.sante_evenements is
  'Registre santé d''un enfant : médicaments administrés, incidents, soins et visites médicales ou psychologiques. Données de santé de mineurs : aucun accès anonyme.';

create index if not exists sante_evenements_enfant_date_idx
  on public.sante_evenements ((data ->> 'enfantId'), (data ->> 'date') desc);

create index if not exists sante_evenements_enfant_type_idx
  on public.sante_evenements ((data ->> 'enfantId'), (data ->> 'type'));

alter table public.sante_evenements enable row level security;

-- ----------------------------------------------------------------------------
-- Politiques : même périmètre que les présences, avec en plus l'exigence d'un
-- directeur approuvé pour les écritures (un compte en attente reste en lecture).
-- ----------------------------------------------------------------------------

drop policy if exists sante_evenements_select on public.sante_evenements;
create policy sante_evenements_select
  on public.sante_evenements for select
  using (
    rawdha_is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = (sante_evenements.data ->> 'enfantId')
        and (e.data ->> 'crecheId') = auth.uid()::text
    )
  );

drop policy if exists sante_evenements_insert on public.sante_evenements;
create policy sante_evenements_insert
  on public.sante_evenements for insert
  with check (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and exists (
        select 1 from public.enfants e
        where e.id = (sante_evenements.data ->> 'enfantId')
          and (e.data ->> 'crecheId') = auth.uid()::text
      )
    )
  );

drop policy if exists sante_evenements_update on public.sante_evenements;
create policy sante_evenements_update
  on public.sante_evenements for update
  using (
    rawdha_is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = (sante_evenements.data ->> 'enfantId')
        and (e.data ->> 'crecheId') = auth.uid()::text
    )
  )
  with check (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and exists (
        select 1 from public.enfants e
        where e.id = (sante_evenements.data ->> 'enfantId')
          and (e.data ->> 'crecheId') = auth.uid()::text
      )
    )
  );

drop policy if exists sante_evenements_delete on public.sante_evenements;
create policy sante_evenements_delete
  on public.sante_evenements for delete
  using (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and exists (
        select 1 from public.enfants e
        where e.id = (sante_evenements.data ->> 'enfantId')
          and (e.data ->> 'crecheId') = auth.uid()::text
      )
    )
  );

-- ----------------------------------------------------------------------------
-- Privilèges : données de santé d'enfants mineurs, donc aucun accès `anon`.
-- ----------------------------------------------------------------------------

revoke all on public.sante_evenements from public, anon;
grant select, insert, update, delete on public.sante_evenements to authenticated;

commit;

-- ----------------------------------------------------------------------------
-- Contrôle après migration (à exécuter séparément) :
--
--   select policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename = 'sante_evenements'
--   order by policyname;
--
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'sante_evenements';
--
-- ----------------------------------------------------------------------------
-- ROLLBACK D'URGENCE (décommenter et exécuter uniquement si nécessaire) :
--
--   drop table if exists public.sante_evenements;
--
-- Aucune donnée métier existante n'est affectée par ce rollback : la table est
-- nouvelle et n'est référencée par aucune autre table.
-- ----------------------------------------------------------------------------
