-- Rollback RawdhaPlus — journaux d'activité
-- À exécuter uniquement après confirmation explicite, car il supprime l'historique d'audit.

drop trigger if exists rawdha_activity_enfants on public.enfants;
drop trigger if exists rawdha_activity_presences on public.presences;
drop trigger if exists rawdha_activity_paiements on public.paiements;
drop trigger if exists rawdha_activity_personnel on public.personnel;
drop trigger if exists rawdha_activity_classes on public.classes;
drop trigger if exists rawdha_activity_activites on public.activites;
drop trigger if exists rawdha_activity_repas on public.repas;
drop trigger if exists rawdha_activity_presence_journees on public.presence_journees;

drop function if exists public.rawdha_log_activity();
drop table if exists public.activity_logs;
