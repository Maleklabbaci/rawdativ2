-- RAWDHA+ — Communauté professionnelle privée entre crèches
-- Les tables utilisent le même stockage JSONB que le reste de l'application.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;

grant select, insert, update, delete on public.community_posts to authenticated;
grant select, insert, update, delete on public.community_comments to authenticated;
revoke all on public.community_posts from anon;
revoke all on public.community_comments from anon;

-- Publications : les directeurs et l'admin peuvent lire ; un contenu masqué
-- reste visible uniquement par l'admin.
drop policy if exists "community_posts_select" on public.community_posts;
create policy "community_posts_select" on public.community_posts
for select using (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and coalesce(data->>'statut', 'publie') <> 'masquee'
  )
);

drop policy if exists "community_posts_insert" on public.community_posts;
create policy "community_posts_insert" on public.community_posts
for insert with check (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'authorId' = auth.uid()::text
    and data->>'crecheId' = auth.uid()::text
  )
);

drop policy if exists "community_posts_update" on public.community_posts;
create policy "community_posts_update" on public.community_posts
for update using (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'authorId' = auth.uid()::text
  )
)
with check (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'authorId' = auth.uid()::text
    and data->>'crecheId' = auth.uid()::text
  )
);

drop policy if exists "community_posts_delete" on public.community_posts;
create policy "community_posts_delete" on public.community_posts
for delete using (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'authorId' = auth.uid()::text
  )
);

-- Commentaires : mêmes rôles, avec un auteur lié à la session et un post
-- existant. Les commentaires d'un post masqué ne sont pas lisibles par un directeur.
drop policy if exists "community_comments_select" on public.community_comments;
create policy "community_comments_select" on public.community_comments
for select using (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and exists (
      select 1 from public.community_posts p
      where p.id::text = community_comments.data->>'postId'
        and coalesce(p.data->>'statut', 'publie') <> 'masquee'
    )
  )
);

drop policy if exists "community_comments_insert" on public.community_comments;
create policy "community_comments_insert" on public.community_comments
for insert with check (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'authorId' = auth.uid()::text
    and exists (
      select 1 from public.community_posts p
      where p.id::text = data->>'postId'
        and coalesce(p.data->>'statut', 'publie') <> 'masquee'
    )
  )
);

drop policy if exists "community_comments_update" on public.community_comments;
create policy "community_comments_update" on public.community_comments
for update using (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'authorId' = auth.uid()::text
  )
)
with check (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'authorId' = auth.uid()::text
  )
);

drop policy if exists "community_comments_delete" on public.community_comments;
create policy "community_comments_delete" on public.community_comments
for delete using (
  public.rawdha_is_admin()
  or (
    public.rawdha_current_role() = 'directeur'
    and data->>'authorId' = auth.uid()::text
  )
);

create index if not exists community_posts_created_at_idx
  on public.community_posts ((data->>'createdAt'));
create index if not exists community_posts_category_idx
  on public.community_posts ((data->>'categorie'));
create index if not exists community_comments_post_id_idx
  on public.community_comments ((data->>'postId'));
