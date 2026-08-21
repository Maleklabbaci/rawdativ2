-- Rawdha Connect: fonctionnalités sociales additionnelles.
-- Migration additive : aucune table ou donnée existante n'est supprimée.

create table if not exists public.community_features (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists community_features_kind_idx
  on public.community_features ((data ->> 'kind'));

create index if not exists community_features_actor_idx
  on public.community_features ((data ->> 'actorId'));

create index if not exists community_features_target_idx
  on public.community_features ((data ->> 'targetId'));

alter table public.community_features enable row level security;

 drop policy if exists community_features_select on public.community_features;
create policy community_features_select
  on public.community_features for select
  using (
    rawdha_is_admin()
    or (
      rawdha_current_role() = 'directeur'
      and (
        coalesce(data ->> 'visibility', 'private') = 'public'
        or data ->> 'actorId' = auth.uid()::text
        or data ->> 'recipientId' = auth.uid()::text
      )
    )
  );

 drop policy if exists community_features_insert on public.community_features;
create policy community_features_insert
  on public.community_features for insert
  with check (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and data ->> 'actorId' = auth.uid()::text
    )
  );

 drop policy if exists community_features_update on public.community_features;
create policy community_features_update
  on public.community_features for update
  using (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and data ->> 'actorId' = auth.uid()::text
    )
  )
  with check (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and data ->> 'actorId' = auth.uid()::text
    )
  );

 drop policy if exists community_features_delete on public.community_features;
create policy community_features_delete
  on public.community_features for delete
  using (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and data ->> 'actorId' = auth.uid()::text
    )
  );
