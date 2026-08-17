-- ROLLBACK d'urgence pour supabase_security_hardening.sql
-- À utiliser seulement si un parcours critique est bloqué après vérification.
-- Ce rollback restaure l'accès anon précédent : il ne doit pas rester appliqué
-- plus longtemps que nécessaire.

begin;

-- Restaurer l'exécution RPC précédente pour les rôles clients.
grant execute on function public.rawdha_create_inscription_link(text, timestamptz) to anon, authenticated;
grant execute on function public.rawdha_decide_admission(text, text, text) to anon, authenticated;
grant execute on function public.rawdha_provision_inscription_link(text, text) to anon, authenticated;
grant execute on function public.rawdha_provision_qr_after_director_created() to anon, authenticated;
grant execute on function public.generate_due_invoices() to anon, authenticated;
grant execute on function public.handle_new_director_signup() to anon, authenticated;
grant execute on function public.rls_auto_enable() to anon, authenticated;
grant execute on function public.sync_auth_last_activity_to_compte() to anon, authenticated;

-- Revenir au search_path mutable d'avant le durcissement.
alter function public.current_user_role() reset search_path;
alter function public.current_user_creche_id() reset search_path;
alter function public.current_user_enfant_id() reset search_path;
alter function public.is_admin() reset search_path;

-- Restaurer les privilèges anon des tables. À retirer de ce rollback si le
-- projet avait déjà été durci manuellement avant la migration.
grant all on table public.enfants,
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
to anon;

commit;
