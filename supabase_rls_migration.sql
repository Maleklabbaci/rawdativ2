-- ============================================================================
-- RAWDHA+ — Migration RLS : isolation réelle multi-tenant entre crèches
-- ============================================================================
-- CONTEXTE : tes policies actuelles ("allow all ... using (true)") laissent
-- n'importe quel utilisateur (même non connecté, si les grants "anon" sont
-- actifs par défaut) lire/modifier les données de TOUTES les crèches via
-- l'API Supabase directe, même si le front filtre déjà l'affichage. Cette
-- migration déplace la vérification côté serveur, là où elle doit être.
--
-- ⚠️ AVANT DE LANCER :
--   1. Exporte tes tables en CSV (Table Editor -> ... -> Export) par sécurité.
--   2. Lance ce script en dehors des heures d'utilisation par tes clients.
--   3. Juste après, fais la CHECKLIST DE TEST tout en bas de ce fichier.
--   4. En cas de souci, le bloc ROLLBACK D'URGENCE tout en bas restaure
--      l'ancien comportement (permissif) en une seule exécution.
--
-- À copier-coller dans Supabase Dashboard -> SQL Editor -> New query -> Run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- ÉTAPE 1 — Fonctions utilitaires
-- SECURITY DEFINER : elles peuvent lire "comptes" même quand RLS bloquerait
-- l'accès direct. Sans ça, une policy sur "comptes" qui interroge "comptes"
-- pour connaître le rôle de l'utilisateur créerait une boucle infinie.
-- ----------------------------------------------------------------------------

create or replace function public.rawdha_current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select data->>'role' from public.comptes where id = auth.uid()::text
$$;

create or replace function public.rawdha_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.rawdha_current_role() = 'admin', false)
$$;


-- ----------------------------------------------------------------------------
-- ÉTAPE 2 — Tables scopées directement par crecheId
-- Règle : admin voit/modifie tout. Un directeur ne voit/modifie que les
-- lignes où data->>'crecheId' = son propre id (= auth.uid()).
-- Ça correspond exactement à ce que le front filtre déjà côté client
-- (voir DbContext.tsx), donc ça ne devrait rien casser dans l'UI.
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['enfants','classes','personnel','activites','repas'] loop
    execute format('drop policy if exists %I on %I', 'allow all ' || t, t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);
    execute format($f$
      create policy "%1$s_select" on %1$s for select
        using (rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text)
    $f$, t);
    execute format($f$
      create policy "%1$s_insert" on %1$s for insert
        with check (rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text)
    $f$, t);
    execute format($f$
      create policy "%1$s_update" on %1$s for update
        using (rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text)
        with check (rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text)
    $f$, t);
    execute format($f$
      create policy "%1$s_delete" on %1$s for delete
        using (rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text)
    $f$, t);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- ÉTAPE 3 — Présences & paiements
-- Pas de crecheId direct : on vérifie via l'enfant concerné (enfantId).
-- ----------------------------------------------------------------------------

drop policy if exists "allow all presences" on presences;
drop policy if exists "presences_select" on presences;
create policy "presences_select" on presences for select
  using (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (presences.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  );
drop policy if exists "presences_insert" on presences;
create policy "presences_insert" on presences for insert
  with check (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (presences.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  );
drop policy if exists "presences_update" on presences;
create policy "presences_update" on presences for update
  using (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (presences.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  )
  with check (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (presences.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  );
drop policy if exists "presences_delete" on presences;
create policy "presences_delete" on presences for delete
  using (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (presences.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  );

drop policy if exists "allow all paiements" on paiements;
drop policy if exists "paiements_select" on paiements;
create policy "paiements_select" on paiements for select
  using (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (paiements.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  );
drop policy if exists "paiements_insert" on paiements;
create policy "paiements_insert" on paiements for insert
  with check (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (paiements.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  );
drop policy if exists "paiements_update" on paiements;
create policy "paiements_update" on paiements for update
  using (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (paiements.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  )
  with check (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (paiements.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  );
drop policy if exists "paiements_delete" on paiements;
create policy "paiements_delete" on paiements for delete
  using (
    rawdha_is_admin()
    or exists (select 1 from enfants e where e.id = (paiements.data->>'enfantId') and (e.data->>'crecheId') = auth.uid()::text)
  );


-- ----------------------------------------------------------------------------
-- ÉTAPE 4 — Comptes
-- Admin voit/gère tout. Un utilisateur ne voit que SA propre ligne (nécessaire
-- pour charger son profil au login). Pas de policy insert/delete pour
-- anon/authenticated : la création et la suppression passent UNIQUEMENT par
-- les Edge Functions create-account / delete-account, qui utilisent la clé
-- service_role et contournent RLS de toute façon — donc rien à ouvrir ici.
-- ----------------------------------------------------------------------------

drop policy if exists "allow all comptes" on comptes;
drop policy if exists "comptes_select" on comptes;
create policy "comptes_select" on comptes for select
  using (rawdha_is_admin() or id = auth.uid()::text);
drop policy if exists "comptes_update" on comptes;
create policy "comptes_update" on comptes for update
  using (rawdha_is_admin() or id = auth.uid()::text)
  with check (rawdha_is_admin() or id = auth.uid()::text);


-- ----------------------------------------------------------------------------
-- ÉTAPE 5 — discussion_messages
-- Un directeur ne voit que SON fil (parentId = son id). L'admin voit tout.
-- ----------------------------------------------------------------------------

drop policy if exists "allow all discussion_messages" on discussion_messages;
drop policy if exists "messages_select" on discussion_messages;
create policy "messages_select" on discussion_messages for select
  using (rawdha_is_admin() or (data->>'parentId') = auth.uid()::text);
drop policy if exists "messages_insert" on discussion_messages;
create policy "messages_insert" on discussion_messages for insert
  with check (rawdha_is_admin() or (data->>'parentId') = auth.uid()::text);
drop policy if exists "messages_update" on discussion_messages;
create policy "messages_update" on discussion_messages for update
  using (rawdha_is_admin() or (data->>'parentId') = auth.uid()::text)
  with check (rawdha_is_admin() or (data->>'parentId') = auth.uid()::text);
drop policy if exists "messages_delete" on discussion_messages;
create policy "messages_delete" on discussion_messages for delete
  using (rawdha_is_admin() or (data->>'parentId') = auth.uid()::text);


-- ----------------------------------------------------------------------------
-- ÉTAPE 6 — parametres
-- Chaque directeur ne lit/écrit que SA ligne (id = 'creche_' || son id).
-- ----------------------------------------------------------------------------

drop policy if exists "allow all parametres" on parametres;
drop policy if exists "parametres_select" on parametres;
create policy "parametres_select" on parametres for select
  using (rawdha_is_admin() or id = 'creche_' || auth.uid()::text);
drop policy if exists "parametres_insert" on parametres;
create policy "parametres_insert" on parametres for insert
  with check (rawdha_is_admin() or id = 'creche_' || auth.uid()::text);
drop policy if exists "parametres_update" on parametres;
create policy "parametres_update" on parametres for update
  using (rawdha_is_admin() or id = 'creche_' || auth.uid()::text)
  with check (rawdha_is_admin() or id = 'creche_' || auth.uid()::text);
drop policy if exists "parametres_delete" on parametres;
create policy "parametres_delete" on parametres for delete
  using (rawdha_is_admin() or id = 'creche_' || auth.uid()::text);


-- ----------------------------------------------------------------------------
-- ÉTAPE 7 — avis
-- Chacun ne voit/crée que SES propres avis (+ admin voit tout).
-- ----------------------------------------------------------------------------

drop policy if exists "allow all avis" on avis;
drop policy if exists "avis_select" on avis;
create policy "avis_select" on avis for select
  using (rawdha_is_admin() or (data->>'userId') = auth.uid()::text);
drop policy if exists "avis_insert" on avis;
create policy "avis_insert" on avis for insert
  with check (rawdha_is_admin() or (data->>'userId') = auth.uid()::text);


-- ----------------------------------------------------------------------------
-- ÉTAPE 8 — notifications
-- ⚠️ Cette table n'apparaît PAS dans ton supabase_schema.sql d'origine — elle a
-- dû être créée plus tard directement depuis le Dashboard. Si la ligne
-- "alter table notifications enable row level security" ci-dessous échoue
-- avec une erreur "relation does not exist", décommente d'abord le bloc
-- "create table" juste en dessous, puis relance.
-- ----------------------------------------------------------------------------

-- create table if not exists notifications (
--   id text primary key,
--   data jsonb not null default '{}'::jsonb,
--   created_at timestamptz default now()
-- );

alter table notifications enable row level security;
drop policy if exists "allow all notifications" on notifications;
drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications for select
  using (
    rawdha_is_admin()
    or (data->>'recipientRole') = 'all_directeurs'
    or (data->>'recipientRole') = auth.uid()::text
  );
drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications for insert
  with check (rawdha_is_admin());
drop policy if exists "notifications_update" on notifications;
create policy "notifications_update" on notifications for update
  using (
    rawdha_is_admin()
    or (data->>'recipientRole') = 'all_directeurs'
    or (data->>'recipientRole') = auth.uid()::text
  )
  with check (true); -- un directeur doit pouvoir mettre à jour "readBy" pour marquer comme lue
drop policy if exists "notifications_delete" on notifications;
create policy "notifications_delete" on notifications for delete
  using (rawdha_is_admin());


-- ----------------------------------------------------------------------------
-- ÉTAPE 9 (recommandé, optionnel) — retirer l'accès aux utilisateurs NON
-- connectés. Aujourd'hui le rôle "anon" (visiteur non authentifié) a
-- probablement encore les droits SELECT/INSERT/UPDATE/DELETE par défaut sur
-- ces tables. Avec les policies ci-dessus, auth.uid() est NULL pour un
-- visiteur anonyme donc il ne verra déjà plus rien -- mais autant fermer la
-- porte explicitement en défense en profondeur.
-- ----------------------------------------------------------------------------

revoke all on enfants, classes, personnel, activites, repas, presences, paiements,
  comptes, discussion_messages, parametres, avis, notifications
  from anon;


-- ============================================================================
-- CHECKLIST DE TEST — à faire juste après avoir lancé ce script
-- ============================================================================
-- [ ] Connecte-toi en tant qu'ADMIN -> tu dois toujours voir tous les
--     directeurs dans "Comptes", pouvoir en créer/suspendre/supprimer.
-- [ ] Connecte-toi en tant que DIRECTEUR A -> Dashboard, Enfants, Classes,
--     Présences, Paiements, Personnel, Activités, Repas s'affichent
--     normalement avec SES données.
-- [ ] En tant que Directeur A, ajoute un enfant, une présence, un paiement,
--     modifie-les, supprime-les -> tout doit fonctionner sans erreur.
-- [ ] Ouvre les DevTools (F12) -> Console, en étant connecté en Directeur A,
--     tape :
--       await window.supabase.from('enfants').select('*')
--     (si "supabase" n'est pas exposé globalement, ignore ce test précis —
--     l'essentiel est que l'UI elle-même ne montre que les données du
--     Directeur A). Le résultat ne doit contenir QUE les enfants avec
--     crecheId = l'id du Directeur A, jamais ceux d'un autre directeur.
-- [ ] Vérifie que la messagerie (ChatBubble) fonctionne toujours pour un
--     directeur (envoi/réception avec le support/admin).
-- [ ] Vérifie que les notifications admin -> directeurs s'affichent toujours.
-- [ ] Vérifie que la génération auto de facture (à l'échéance du mois)
--     fonctionne toujours pour un compte directeur de test.
--
-- Si un de ces points casse : utilise le ROLLBACK D'URGENCE ci-dessous, puis
-- dis-moi précisément ce qui a cassé pour qu'on ajuste la policy concernée.
-- ============================================================================


-- ============================================================================
-- ROLLBACK D'URGENCE — restaure l'ancien comportement permissif si besoin
-- (à copier-coller et exécuter séparément, seulement en cas de blocage réel)
-- ============================================================================
-- do $$
-- declare
--   t text;
-- begin
--   foreach t in array array['enfants','classes','personnel','activites','repas',
--     'presences','paiements','comptes','discussion_messages','parametres','avis','notifications'] loop
--     execute format('drop policy if exists "%s_select" on %I', t, t);
--     execute format('drop policy if exists "%s_insert" on %I', t, t);
--     execute format('drop policy if exists "%s_update" on %I', t, t);
--     execute format('drop policy if exists "%s_delete" on %I', t, t);
--     execute format('create policy "allow all %1$s" on %1$s for all using (true) with check (true)', t);
--   end loop;
-- end $$;
-- grant all on enfants, classes, personnel, activites, repas, presences, paiements,
--   comptes, discussion_messages, parametres, avis, notifications to anon;
-- ============================================================================
