-- Rawdha Connect: enregistrement sécurisé et idempotent des vues de publications.
-- Migration additive : aucune donnée existante n'est supprimée.

create or replace function public.rawdha_record_community_post_view(p_post_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  post_author_id text;
  view_id text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if not (public.rawdha_is_admin() or public.rawdha_is_approved_director()) then
    return false;
  end if;

  select p.data ->> 'authorId'
    into post_author_id
  from public.community_posts p
  where p.id::text = p_post_id
    and coalesce(p.data ->> 'statut', 'publie') <> 'masquee';

  if post_author_id is null then
    return false;
  end if;

  if post_author_id = auth.uid()::text then
    return true;
  end if;

  view_id := 'post_view_' || auth.uid()::text || '_' || p_post_id;

  insert into public.community_features (id, data)
  values (
    view_id,
    jsonb_build_object(
      'kind', 'post_view',
      'actorId', auth.uid()::text,
      'targetId', p_post_id,
      'recipientId', post_author_id,
      'visibility', 'public',
      'createdAt', now()::text
    )
  )
  on conflict (id) do nothing;

  return true;
end;
$function$;

revoke all on function public.rawdha_record_community_post_view(text) from public;
grant execute on function public.rawdha_record_community_post_view(text) to authenticated;
