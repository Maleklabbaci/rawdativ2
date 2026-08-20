-- Compatibilité des anciens comptes créés avant approvalStatus.
begin;

create or replace function public.rawdha_is_approved_director()
returns boolean
language sql
security definer
stable
set search_path = public
as $pending$
  select coalesce(
    (c.data->>'role' = 'directeur'
      and coalesce(
        c.data->>'approvalStatus',
        case when exists (
          select 1
          from auth.users au
          where au.id::text = auth.uid()::text
            and au.raw_user_meta_data->>'pendingDirector' = 'true'
        ) then 'pending' else 'approved' end
      ) <> 'pending'),
    false
  )
  from public.comptes c
  where c.id = auth.uid()::text
$pending$;

grant execute on function public.rawdha_is_approved_director() to authenticated;
revoke execute on function public.rawdha_is_approved_director() from anon;

commit;
