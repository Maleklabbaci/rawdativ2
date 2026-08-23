-- Correction de sécurité additive pour les RPC Achats déjà créées.
-- Les fonctions d'écriture ne sont jamais accessibles au rôle anon.

revoke all on function public.rawdha_normalize_achat_data(jsonb, text, text, timestamptz) from anon, authenticated;
revoke all on function public.rawdha_create_achat(jsonb) from anon;
revoke all on function public.rawdha_update_achat(text, jsonb) from anon;
revoke all on function public.rawdha_delete_achat(text) from anon;

grant execute on function public.rawdha_create_achat(jsonb) to authenticated;
grant execute on function public.rawdha_update_achat(text, jsonb) to authenticated;
grant execute on function public.rawdha_delete_achat(text) to authenticated;
