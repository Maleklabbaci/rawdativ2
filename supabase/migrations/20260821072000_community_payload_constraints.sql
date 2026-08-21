-- Rawdha Connect: validation minimale des payloads JSONB.
-- Migration additive : aucune donnée existante n'est supprimée.

alter table public.community_posts
  drop constraint if exists community_posts_data_valid;
alter table public.community_posts
  add constraint community_posts_data_valid check (
    jsonb_typeof(data) = 'object'
    and char_length(trim(coalesce(data ->> 'authorId', ''))) > 0
    and char_length(trim(coalesce(data ->> 'crecheId', ''))) > 0
    and data ->> 'categorie' in ('activite', 'materiel', 'vente_echange', 'recrutement', 'formation', 'partenariat')
    and char_length(trim(coalesce(data ->> 'contenu', ''))) between 1 and 3000
    and coalesce(data ->> 'statut', 'publie') in ('publie', 'masquee')
    and (not (data ? 'imageUrls') or (jsonb_typeof(data -> 'imageUrls') = 'array' and jsonb_array_length(data -> 'imageUrls') between 1 and 6))
  ) not valid;

alter table public.community_comments
  drop constraint if exists community_comments_data_valid;
alter table public.community_comments
  add constraint community_comments_data_valid check (
    jsonb_typeof(data) = 'object'
    and char_length(trim(coalesce(data ->> 'postId', ''))) > 0
    and char_length(trim(coalesce(data ->> 'authorId', ''))) > 0
    and char_length(trim(coalesce(data ->> 'contenu', ''))) between 1 and 1000
  ) not valid;

alter table public.community_reactions
  drop constraint if exists community_reactions_data_valid;
alter table public.community_reactions
  add constraint community_reactions_data_valid check (
    jsonb_typeof(data) = 'object'
    and char_length(trim(coalesce(data ->> 'postId', ''))) > 0
    and char_length(trim(coalesce(data ->> 'userId', ''))) > 0
  ) not valid;

alter table public.community_features
  drop constraint if exists community_features_data_valid;
alter table public.community_features
  add constraint community_features_data_valid check (
    jsonb_typeof(data) = 'object'
    and data ->> 'kind' in ('follow', 'saved_post', 'social_notification', 'poll_vote', 'report', 'pin', 'profile_details', 'private_message', 'post_view')
    and char_length(trim(coalesce(data ->> 'actorId', ''))) > 0
    and (
      data ->> 'kind' <> 'private_message'
      or (
        char_length(trim(coalesce(data ->> 'recipientId', ''))) > 0
        and jsonb_typeof(data -> 'payload') = 'object'
        and char_length(trim(coalesce(data #>> '{payload,content}', ''))) between 1 and 1000
      )
    )
  ) not valid;
