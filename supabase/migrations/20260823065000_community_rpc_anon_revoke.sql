-- Les mutations Rawdha Connect sont réservées aux comptes authentifiés.
-- Cette migration est additive et ne modifie aucune publication, réaction,
-- commentaire, message ou donnée métier existante.

revoke all on function public.rawdha_create_community_comment(jsonb) from public, anon, authenticated;
revoke all on function public.rawdha_update_community_comment(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.rawdha_delete_community_comment(uuid) from public, anon, authenticated;
revoke all on function public.rawdha_create_community_reaction(text) from public, anon, authenticated;
revoke all on function public.rawdha_delete_community_reaction(text) from public, anon, authenticated;
revoke all on function public.rawdha_create_community_feature(jsonb) from public, anon, authenticated;
revoke all on function public.rawdha_update_community_feature(text, jsonb) from public, anon, authenticated;
revoke all on function public.rawdha_delete_community_feature(text) from public, anon, authenticated;
revoke all on function public.rawdha_mark_community_feature_read(text) from public, anon, authenticated;
revoke all on function public.rawdha_record_community_post_view(text) from public, anon, authenticated;

grant execute on function public.rawdha_create_community_comment(jsonb) to authenticated;
grant execute on function public.rawdha_update_community_comment(uuid, jsonb) to authenticated;
grant execute on function public.rawdha_delete_community_comment(uuid) to authenticated;
grant execute on function public.rawdha_create_community_reaction(text) to authenticated;
grant execute on function public.rawdha_delete_community_reaction(text) to authenticated;
grant execute on function public.rawdha_create_community_feature(jsonb) to authenticated;
grant execute on function public.rawdha_update_community_feature(text, jsonb) to authenticated;
grant execute on function public.rawdha_delete_community_feature(text) to authenticated;
grant execute on function public.rawdha_mark_community_feature_read(text) to authenticated;
grant execute on function public.rawdha_record_community_post_view(text) to authenticated;
