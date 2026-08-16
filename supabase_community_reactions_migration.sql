-- RAWDHA+ — Réactions de la communauté professionnelle privée
create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb
);

alter table public.community_reactions enable row level security;

grant select, insert, delete on public.community_reactions to authenticated;
revoke all on public.community_reactions from anon;

drop policy if exists "community_reactions_select" on public.community_reactions;
create policy "community_reactions_select" on public.community_reactions
for select using (
  public.rawdha_is_admin()
  or public.rawdha_current_role() = 'directeur'
);

drop policy if exists "community_reactions_insert" on public.community_reactions;
create policy "community_reactions_insert" on public.community_reactions
for insert with check (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'userId' = auth.uid()::text
    and exists (
      select 1 from public.community_posts p
      where p.id::text = community_reactions.data->>'postId'
        and coalesce(p.data->>'statut', 'publie') <> 'masquee'
    )
  )
);

drop policy if exists "community_reactions_delete" on public.community_reactions;
create policy "community_reactions_delete" on public.community_reactions
for delete using (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'userId' = auth.uid()::text
  )
);

create unique index if not exists community_reactions_unique_user_post_idx
  on public.community_reactions ((data->>'postId'), (data->>'userId'));
