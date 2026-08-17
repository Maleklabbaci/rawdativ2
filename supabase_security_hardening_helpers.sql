-- Durcissement P1 : les helpers d'identité et d'administration ne doivent pas
-- être appelables par le rôle anon. Les utilisateurs authentifiés et les
-- politiques RLS conservent leur accès.

begin;

revoke execute on function public.current_user_creche_id() from public, anon;
revoke execute on function public.current_user_enfant_id() from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.rawdha_current_role() from public, anon;
revoke execute on function public.rawdha_is_admin() from public, anon;

-- Cette table legacy n'est référencée par aucun appel du front actuel.
revoke all on table public.demandes_directeur from public, anon;

grant execute on function public.current_user_creche_id() to authenticated;
grant execute on function public.current_user_enfant_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.rawdha_current_role() to authenticated;
grant execute on function public.rawdha_is_admin() to authenticated;

commit;
