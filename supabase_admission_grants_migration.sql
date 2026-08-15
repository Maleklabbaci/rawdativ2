-- Rawdha+ — Correctif des droits de lecture des admissions QR
-- Les demandes publiques continuent de passer par les RPC SECURITY DEFINER.
-- Le directeur authentifié doit seulement pouvoir lire les lignes autorisées par les policies RLS.

grant select on table public.inscription_liens to authenticated;
grant select on table public.demandes_admission to authenticated;

-- L’accès anonyme reste fermé sur les tables. Le formulaire public utilise uniquement
-- rawdha_get_inscription_context et rawdha_submit_admission.
revoke all on table public.inscription_liens from anon;
revoke all on table public.demandes_admission from anon;

-- Réaffirmer les droits d’exécution des RPC publics et de décision directeur.
grant execute on function public.rawdha_get_inscription_context(text) to anon, authenticated;
grant execute on function public.rawdha_submit_admission(text, jsonb) to anon, authenticated;
grant execute on function public.rawdha_create_inscription_link(text, timestamptz) to authenticated;
grant execute on function public.rawdha_decide_admission(text, text, text) to authenticated;

-- Les policies existantes limitent les SELECT à la crèche du directeur ou à l’administrateur.
select 'admission read grants applied' as status;

