-- Per-account onboarding progress; no children or staff data stored here.
begin;
create table if not exists public.director_onboarding (
  account_id text primary key references public.comptes(id) on delete cascade,
  step text not null default 'welcome' check (step in ('welcome','language','children','classes','team','done')),
  language text check (language is null or language in ('fr','ar')),
  task_page text check (task_page is null or task_page in ('enfants','classes','personnel')),
  updated_at timestamptz not null default now()
);
alter table public.director_onboarding enable row level security;
revoke all on public.director_onboarding from public, anon, authenticated;
grant select, update on public.director_onboarding to authenticated;
grant select, insert, update, delete on public.director_onboarding to service_role;
create policy director_onboarding_select on public.director_onboarding for select to authenticated using (account_id = auth.uid()::text);
create policy director_onboarding_update on public.director_onboarding for update to authenticated using (account_id = auth.uid()::text) with check (account_id = auth.uid()::text);
commit;
