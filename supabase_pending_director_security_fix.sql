begin;
revoke execute on function public.rawdha_is_approved_director() from public, anon;
grant execute on function public.rawdha_is_approved_director() to authenticated;
commit;
