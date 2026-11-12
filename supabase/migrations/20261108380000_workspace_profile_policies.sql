-- Autorise chaque directrice approuvée à synchroniser uniquement ses profils d'équipe.
-- Les profils partagent l'authentification de la directrice : ce n'est pas une
-- isolation serveur des permissions individuelles. Ne pas utiliser pour de vraies données
-- sans authentification et autorisations serveur propres à chaque membre.
create policy workspace_profiles_select on public.parametres for select to authenticated
  using (id = 'profils_equipe_' || auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false));
create policy workspace_profiles_insert on public.parametres for insert to authenticated
  with check (id = 'profils_equipe_' || auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false));
create policy workspace_profiles_update on public.parametres for update to authenticated
  using (id = 'profils_equipe_' || auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false))
  with check (id = 'profils_equipe_' || auth.uid()::text and coalesce(public.rawdha_is_approved_director(), false));
