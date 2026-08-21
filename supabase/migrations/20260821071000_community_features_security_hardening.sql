-- Rawdha Connect: durcissement des permissions et de la confidentialité.
-- Migration additive : aucune publication ni fonctionnalité existante n'est supprimée.

create index if not exists community_features_recipient_idx
  on public.community_features ((data ->> 'recipientId'));

drop policy if exists community_features_select on public.community_features;
create policy community_features_select
  on public.community_features for select
  using (
    rawdha_is_admin()
    or (
      rawdha_current_role() = 'directeur'
      and (
        (
          coalesce(data ->> 'visibility', 'private') = 'public'
          and coalesce(data ->> 'kind', '') <> 'post_view'
        )
        or data ->> 'actorId' = auth.uid()::text
        or data ->> 'recipientId' = auth.uid()::text
        or (
          data ->> 'kind' = 'post_view'
          and exists (
            select 1
            from public.community_posts p
            where p.id::text = data ->> 'targetId'
              and p.data ->> 'authorId' = auth.uid()::text
          )
        )
      )
    )
  );

drop policy if exists community_features_insert on public.community_features;
create policy community_features_insert
  on public.community_features for insert
  with check (
    (
      rawdha_is_admin()
      and data ->> 'actorId' = auth.uid()::text
    )
    or (
      rawdha_is_approved_director()
      and data ->> 'actorId' = auth.uid()::text
      and data ->> 'kind' in ('follow', 'saved_post', 'social_notification', 'poll_vote', 'report', 'private_message', 'post_view')
      and (
        data ->> 'kind' not in ('saved_post', 'poll_vote', 'report', 'post_view')
        or exists (
          select 1
          from public.community_posts p
          where p.id::text = data ->> 'targetId'
            and coalesce(p.data ->> 'statut', 'publie') <> 'masquee'
        )
      )
      and (
        data ->> 'kind' <> 'post_view'
        or data ->> 'recipientId' = (
          select p.data ->> 'authorId'
          from public.community_posts p
          where p.id::text = data ->> 'targetId'
        )
      )
      and (
        data ->> 'kind' <> 'private_message'
        or (
          nullif(data ->> 'recipientId', '') is not null
          and data ->> 'recipientId' <> auth.uid()::text
          and jsonb_typeof(data -> 'payload') = 'object'
          and char_length(trim(coalesce(data #>> '{payload,content}', ''))) between 1 and 1000
        )
      )
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
      and data ->> 'kind' in ('follow', 'saved_post', 'poll_vote', 'report')
    )
  )
  with check (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and data ->> 'actorId' = auth.uid()::text
      and data ->> 'kind' in ('follow', 'saved_post', 'poll_vote', 'report')
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
      and data ->> 'kind' in ('follow', 'saved_post', 'poll_vote', 'report')
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
    and data ->> 'recipientId' = auth.uid()::text
    and data ->> 'kind' in ('private_message', 'social_notification')
    and coalesce(data -> 'payload' ->> 'read', 'false') <> 'true';

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$function$;

revoke all on function public.rawdha_mark_community_feature_read(text) from public;
grant execute on function public.rawdha_mark_community_feature_read(text) to authenticated;
