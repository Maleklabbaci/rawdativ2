-- RAWDHA+ — Durcissement P0 de la surface Supabase
--
-- Cette migration est préparée pour revue et staging. Elle n'est PAS appliquée
-- automatiquement à la production par l'agent.
--
-- Objectifs :
-- 1) empêcher anon d'appeler les RPC réservées à une direction authentifiée ;
-- 2) fermer les fonctions internes/trigger au RPC public ;
-- 3) retirer l'accès direct anon aux tables métier ;
-- 4) fixer le search_path des anciens helpers SECURITY DEFINER signalés par le linter.
--
-- À appliquer seulement après export/backup et test sur un projet staging.

begin;

-- Les fonctions publiques d'admission restent accessibles :
-- rawdha_get_inscription_context(text) et rawdha_submit_admission(text, jsonb).
-- Les deux fonctions suivantes sont utilisées par le front authentifié, mais
-- ne doivent jamais être appelables sans session.
revoke execute on function public.rawdha_create_inscription_link(text, timestamptz) from anon;
revoke execute on function public.rawdha_decide_admission(text, text, text) from anon;

grant execute on function public.rawdha_create_inscription_link(text, timestamptz) to authenticated;
grant execute on function public.rawdha_decide_admission(text, text, text) to authenticated;

-- Cette fonction est utilisée par le trigger de provisioning QR, pas par le
-- navigateur. Fermer l'accès RPC évite qu'un directeur fournisse l'id d'une
-- autre crèche et obtienne/modifie son lien.
revoke all on function public.rawdha_provision_inscription_link(text, text) from public, anon, authenticated;
revoke all on function public.rawdha_provision_qr_after_director_created() from public, anon, authenticated;

-- Fonctions internes de tâche/trigger : aucun appel direct depuis le front.
revoke all on function public.generate_due_invoices() from public, anon, authenticated;
revoke all on function public.handle_new_director_signup() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.sync_auth_last_activity_to_compte() from public, anon, authenticated;

-- Défense en profondeur : un visiteur anonyme ne doit pas lire ni modifier les
-- tables métier. Le parcours public d'admission passe uniquement par les RPC
-- dédiées ci-dessus ; demandes_directeur conserve son INSERT public explicite.
revoke all on table public.enfants,
  public.classes,
  public.personnel,
  public.activites,
  public.repas,
  public.presences,
  public.paiements,
  public.comptes,
  public.discussion_messages,
  public.parametres,
  public.avis,
  public.notifications,
  public.demandes_admission,
  public.inscription_liens,
  public.presence_journees,
  public.signalements,
  public.community_posts,
  public.community_comments,
  public.community_reactions
from anon;

-- Les anciens helpers sont encore appelés par certaines policies existantes.
-- On ne révoque donc pas leur EXECUTE ici : on fixe uniquement leur search_path
-- pour supprimer le risque signalé par le linter Supabase.
alter function public.current_user_role() set search_path = public;
alter function public.current_user_creche_id() set search_path = public;
alter function public.current_user_enfant_id() set search_path = public;
alter function public.is_admin() set search_path = public;

commit;

-- Contrôle post-migration à exécuter séparément :
-- select routine_name, routine_schema
-- from information_schema.routines
-- where routine_schema = 'public'
--   and routine_name in ('rawdha_provision_inscription_link', 'generate_due_invoices')
-- limit 20;
--
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where grantee = 'anon'
--   and table_schema = 'public'
-- order by table_name, privilege_type
-- limit 200;
