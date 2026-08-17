-- Rawdha+ — Rollback du durcissement QR parent
-- À exécuter uniquement si une régression est confirmée et après validation.

begin;

drop index if exists public.demandes_admission_pending_dedupe_idx;
revoke all on function public.rawdha_admission_rate_limit(text, text) from public, anon, authenticated;
drop function if exists public.rawdha_admission_rate_limit(text, text);
drop table if exists public.admission_rate_limits;

-- Restaurer les fonctions d’admission historiques versionnées dans
-- supabase_admission_migration.sql avant de réaccorder leurs EXECUTE.
-- Le rollback ne réouvre volontairement aucun accès direct aux tables métier.

commit;
