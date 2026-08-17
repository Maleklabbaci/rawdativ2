-- Correction P0 : retirer le privilège PUBLIC résiduel des RPC internes.
-- La première migration avait retiré anon, mais PUBLIC conservait EXECUTE.

begin;

revoke execute on function public.rawdha_create_inscription_link(text, timestamptz) from public, anon;
revoke execute on function public.rawdha_decide_admission(text, text, text) from public, anon;

grant execute on function public.rawdha_create_inscription_link(text, timestamptz) to authenticated;
grant execute on function public.rawdha_decide_admission(text, text, text) to authenticated;

commit;
