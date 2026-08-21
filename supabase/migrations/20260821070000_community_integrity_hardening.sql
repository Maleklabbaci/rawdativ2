-- Rawdha Connect: intégrité et sécurité des interactions sociales.
-- Migration additive : aucune donnée existante n'est supprimée.

create unique index if not exists community_reactions_post_user_uidx
  on public.community_reactions ((data ->> 'postId'), (data ->> 'userId'));

create unique index if not exists community_features_unique_interaction_uidx
  on public.community_features ((data ->> 'kind'), (data ->> 'targetId'), (data ->> 'actorId'))
  where data ->> 'kind' in ('follow', 'saved_post', 'poll_vote', 'pin', 'report');

 drop policy if exists community_comments_insert on public.community_comments;
create policy community_comments_insert
  on public.community_comments for insert
  with check (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and data ->> 'authorId' = auth.uid()::text
      and exists (
        select 1
        from public.community_posts p
        where p.id::text = data ->> 'postId'
          and coalesce(p.data ->> 'statut', 'publie') <> 'masquee'
      )
    )
  );

 drop policy if exists community_reactions_insert on public.community_reactions;
create policy community_reactions_insert
  on public.community_reactions for insert
  with check (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and data ->> 'userId' = auth.uid()::text
      and exists (
        select 1
        from public.community_posts p
        where p.id::text = data ->> 'postId'
          and coalesce(p.data ->> 'statut', 'publie') <> 'masquee'
      )
    )
  );

 drop policy if exists community_reactions_select on public.community_reactions;
create policy community_reactions_select
  on public.community_reactions for select
  using (
    rawdha_is_admin()
    or (
      rawdha_current_role() = 'directeur'
      and exists (
        select 1
        from public.community_posts p
        where p.id::text = data ->> 'postId'
          and coalesce(p.data ->> 'statut', 'publie') <> 'masquee'
      )
    )
  );

create or replace function public.rawdha_mark_community_feature_read(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.community_features
  set data = jsonb_set(data, '{payload,read}', 'true'::jsonb, true)
  where id = p_id
    and (public.rawdha_is_admin() or data ->> 'recipientId' = auth.uid()::text)
    and data ->> 'kind' in ('private_message', 'social_notification')
    and coalesce(data -> 'payload' ->> 'read', 'false') <> 'true';

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$function$;

revoke all on function public.rawdha_mark_community_feature_read(text) from public;
grant execute on function public.rawdha_mark_community_feature_read(text) to authenticated;
