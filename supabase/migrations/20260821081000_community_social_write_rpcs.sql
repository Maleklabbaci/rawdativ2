-- Rawdha Connect: écritures sociales via RPC sécurisées et idempotentes.
-- Migration additive : aucune donnée existante n'est supprimée.

create or replace function public.rawdha_create_community_comment(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  new_id uuid;
  payload jsonb;
  post_id text;
  content text;
begin
  if auth.uid() is null or not (public.rawdha_is_admin() or public.rawdha_is_approved_director()) then
    return null;
  end if;

  post_id := nullif(trim(coalesce(p_data ->> 'postId', '')), '');
  content := trim(coalesce(p_data ->> 'contenu', ''));

  if post_id is null or char_length(content) not between 1 and 1000 then
    return null;
  end if;

  if not exists (
    select 1
    from public.community_posts p
    where p.id::text = post_id
      and coalesce(p.data ->> 'statut', 'publie') <> 'masquee'
  ) then
    return null;
  end if;

  payload := p_data
    || jsonb_build_object(
      'authorId', auth.uid()::text,
      'contenu', content,
      'createdAt', coalesce(nullif(p_data ->> 'createdAt', ''), now()::text)
    );

  insert into public.community_comments (data)
  values (payload)
  returning id into new_id;

  return new_id;
end;
$function$;

create or replace function public.rawdha_update_community_comment(p_id uuid, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_data jsonb;
  merged_data jsonb;
begin
  if auth.uid() is null or not (public.rawdha_is_admin() or public.rawdha_is_approved_director()) then
    return false;
  end if;

  select data into current_data
  from public.community_comments
  where id = p_id;

  if current_data is null then
    return false;
  end if;

  if not public.rawdha_is_admin() and current_data ->> 'authorId' <> auth.uid()::text then
    return false;
  end if;

  merged_data := current_data || coalesce(p_patch, '{}'::jsonb);
  if char_length(trim(coalesce(merged_data ->> 'contenu', ''))) not between 1 and 1000 then
    return false;
  end if;

  update public.community_comments
  set data = merged_data
  where id = p_id;

  return found;
end;
$function$;

create or replace function public.rawdha_delete_community_comment(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_data jsonb;
begin
  if auth.uid() is null or not (public.rawdha_is_admin() or public.rawdha_is_approved_director()) then
    return false;
  end if;

  select data into current_data
  from public.community_comments
  where id = p_id;

  if current_data is null then
    return false;
  end if;

  if not public.rawdha_is_admin() and current_data ->> 'authorId' <> auth.uid()::text then
    return false;
  end if;

  delete from public.community_comments where id = p_id;
  return found;
end;
$function$;

create or replace function public.rawdha_create_community_reaction(p_post_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  existing_id uuid;
  new_id uuid;
begin
  if auth.uid() is null or not (public.rawdha_is_admin() or public.rawdha_is_approved_director()) then
    return null;
  end if;

  if not exists (
    select 1
    from public.community_posts p
    where p.id::text = p_post_id
      and coalesce(p.data ->> 'statut', 'publie') <> 'masquee'
  ) then
    return null;
  end if;

  select id into existing_id
  from public.community_reactions
  where data ->> 'postId' = p_post_id
    and data ->> 'userId' = auth.uid()::text
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.community_reactions (data)
  values (jsonb_build_object(
    'postId', p_post_id,
    'userId', auth.uid()::text,
    'createdAt', now()::text
  ))
  returning id into new_id;

  return new_id;
end;
$function$;

create or replace function public.rawdha_delete_community_reaction(p_post_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null or not (public.rawdha_is_admin() or public.rawdha_is_approved_director()) then
    return false;
  end if;

  delete from public.community_reactions
  where data ->> 'postId' = p_post_id
    and data ->> 'userId' = auth.uid()::text;

  return found;
end;
$function$;

create or replace function public.rawdha_create_community_feature(p_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  kind text;
  actor_id text;
  target_id text;
  recipient_id text;
  existing_id text;
  new_id text;
  payload jsonb;
begin
  if auth.uid() is null or not (public.rawdha_is_admin() or public.rawdha_is_approved_director()) then
    return null;
  end if;

  kind := nullif(trim(coalesce(p_data ->> 'kind', '')), '');
  actor_id := nullif(trim(coalesce(p_data ->> 'actorId', '')), '');
  target_id := nullif(trim(coalesce(p_data ->> 'targetId', '')), '');
  recipient_id := nullif(trim(coalesce(p_data ->> 'recipientId', '')), '');

  if kind is null or actor_id <> auth.uid()::text then
    return null;
  end if;

  if kind not in ('follow', 'saved_post', 'social_notification', 'poll_vote', 'report', 'pin', 'profile_details', 'private_message', 'post_view') then
    return null;
  end if;

  if kind = 'pin' and not public.rawdha_is_admin() then
    return null;
  end if;

  if kind in ('saved_post', 'poll_vote', 'report', 'pin', 'post_view') and not exists (
    select 1
    from public.community_posts p
    where p.id::text = target_id
      and coalesce(p.data ->> 'statut', 'publie') <> 'masquee'
  ) then
    return null;
  end if;

  if kind in ('saved_post', 'poll_vote', 'report', 'pin', 'post_view') and target_id is null then
    return null;
  end if;

  if kind = 'social_notification' and recipient_id is null then
    return null;
  end if;

  if kind = 'private_message' and (
    recipient_id is null
    or recipient_id = auth.uid()::text
    or jsonb_typeof(p_data -> 'payload') <> 'object'
    or char_length(trim(coalesce(p_data #>> '{payload,content}', ''))) not between 1 and 1000
  ) then
    return null;
  end if;

  if kind = 'poll_vote' and (
    jsonb_typeof(p_data -> 'payload') <> 'object'
    or not ((p_data #>> '{payload,optionIndex}') ~ '^[0-9]+$')
  ) then
    return null;
  end if;

  if kind in ('follow', 'saved_post', 'poll_vote', 'pin', 'report') then
    select id into existing_id
    from public.community_features
    where data ->> 'kind' = kind
      and data ->> 'targetId' = target_id
      and data ->> 'actorId' = auth.uid()::text
    limit 1;
    if existing_id is not null then
      return existing_id;
    end if;
  end if;

  payload := p_data
    || jsonb_build_object(
      'actorId', auth.uid()::text,
      'createdAt', coalesce(nullif(p_data ->> 'createdAt', ''), now()::text)
    );
  new_id := gen_random_uuid()::text;

  insert into public.community_features (id, data)
  values (new_id, payload);

  return new_id;
end;
$function$;

create or replace function public.rawdha_update_community_feature(p_id text, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_data jsonb;
  merged_data jsonb;
  kind text;
begin
  if auth.uid() is null or not (public.rawdha_is_admin() or public.rawdha_is_approved_director()) then
    return false;
  end if;

  select data into current_data
  from public.community_features
  where id = p_id;

  if current_data is null then
    return false;
  end if;

  kind := current_data ->> 'kind';
  if not public.rawdha_is_admin() and (current_data ->> 'actorId' <> auth.uid()::text or kind not in ('follow', 'saved_post', 'poll_vote', 'report')) then
    return false;
  end if;

  merged_data := current_data || coalesce(p_patch, '{}'::jsonb);
  if merged_data ->> 'actorId' <> current_data ->> 'actorId' or merged_data ->> 'kind' <> kind then
    return false;
  end if;

  update public.community_features
  set data = merged_data
  where id = p_id;

  return found;
end;
$function$;

create or replace function public.rawdha_delete_community_feature(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_data jsonb;
  kind text;
begin
  if auth.uid() is null or not (public.rawdha_is_admin() or public.rawdha_is_approved_director()) then
    return false;
  end if;

  select data into current_data
  from public.community_features
  where id = p_id;

  if current_data is null then
    return false;
  end if;

  kind := current_data ->> 'kind';
  if not public.rawdha_is_admin() and (current_data ->> 'actorId' <> auth.uid()::text or kind not in ('follow', 'saved_post', 'poll_vote', 'report')) then
    return false;
  end if;

  delete from public.community_features where id = p_id;
  return found;
end;
$function$;

revoke all on function public.rawdha_create_community_comment(jsonb) from public;
revoke all on function public.rawdha_update_community_comment(uuid, jsonb) from public;
revoke all on function public.rawdha_delete_community_comment(uuid) from public;
revoke all on function public.rawdha_create_community_reaction(text) from public;
revoke all on function public.rawdha_delete_community_reaction(text) from public;
revoke all on function public.rawdha_create_community_feature(jsonb) from public;
revoke all on function public.rawdha_update_community_feature(text, jsonb) from public;
revoke all on function public.rawdha_delete_community_feature(text) from public;

grant execute on function public.rawdha_create_community_comment(jsonb) to authenticated;
grant execute on function public.rawdha_update_community_comment(uuid, jsonb) to authenticated;
grant execute on function public.rawdha_delete_community_comment(uuid) to authenticated;
grant execute on function public.rawdha_create_community_reaction(text) to authenticated;
grant execute on function public.rawdha_delete_community_reaction(text) to authenticated;
grant execute on function public.rawdha_create_community_feature(jsonb) to authenticated;
grant execute on function public.rawdha_update_community_feature(text, jsonb) to authenticated;
grant execute on function public.rawdha_delete_community_feature(text) to authenticated;
