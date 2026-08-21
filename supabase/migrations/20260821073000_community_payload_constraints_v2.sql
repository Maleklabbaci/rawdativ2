-- Rawdha Connect: validation des champs indispensables par interaction.
-- Migration additive : aucune donnée existante n'est supprimée.

alter table public.community_features
  drop constraint if exists community_features_data_valid;

alter table public.community_features
  add constraint community_features_data_valid check (
    jsonb_typeof(data) = 'object'
    and data ->> 'kind' in ('follow', 'saved_post', 'social_notification', 'poll_vote', 'report', 'pin', 'profile_details', 'private_message', 'post_view')
    and char_length(trim(coalesce(data ->> 'actorId', ''))) > 0
    and (
      data ->> 'kind' not in ('follow', 'saved_post', 'poll_vote', 'report', 'pin', 'post_view')
      or char_length(trim(coalesce(data ->> 'targetId', ''))) > 0
    )
    and (
      data ->> 'kind' <> 'social_notification'
      or char_length(trim(coalesce(data ->> 'recipientId', ''))) > 0
    )
    and (
      data ->> 'kind' <> 'private_message'
      or (
        char_length(trim(coalesce(data ->> 'recipientId', ''))) > 0
        and data ->> 'recipientId' <> data ->> 'actorId'
        and jsonb_typeof(data -> 'payload') = 'object'
        and char_length(trim(coalesce(data #>> '{payload,content}', ''))) between 1 and 1000
      )
    )
    and (
      data ->> 'kind' <> 'poll_vote'
      or (
        jsonb_typeof(data -> 'payload') = 'object'
        and (data #>> '{payload,optionIndex}') ~ '^[0-9]+$'
      )
    )
  ) not valid;
