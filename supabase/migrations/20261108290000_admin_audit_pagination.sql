-- Stable keyset pagination; only minimal fields leave the server, never metadata.
begin;
create index if not exists admin_audit_logs_cursor_idx on public.admin_audit_logs ((data->>'createdAt') desc, id desc);
create index if not exists admin_audit_logs_actor_cursor_idx on public.admin_audit_logs ((data->>'actorId'), (data->>'createdAt') desc, id desc);
create or replace function public.rawdha_admin_audit_page(
  p_search text default '', p_category text default 'all', p_actor text default '',
  p_from text default '', p_to text default '', p_cursor_date text default null, p_cursor_id text default null,
  p_limit integer default 25
) returns setof jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if not coalesce(public.rawdha_is_admin(), false) then raise exception 'Accès administrateur requis'; end if;
  if p_category not in ('all','accounts','identity','subscription','support','community','notifications','commercial')
     or length(coalesce(p_search,'')) > 120 or length(coalesce(p_actor,'')) > 200
     or (p_from <> '' and p_from !~ '^\d{4}-\d{2}-\d{2}$')
     or (p_to <> '' and p_to !~ '^\d{4}-\d{2}-\d{2}$')
     or (p_cursor_date is null) <> (p_cursor_id is null) then raise exception 'Filtres invalides'; end if;
  return query select jsonb_strip_nulls(jsonb_build_object(
    'id', l.id, 'actorId', l.data->>'actorId', 'action', l.data->>'action',
    'targetType', l.data->>'targetType', 'targetId', l.data->>'targetId',
    'targetLabel', l.data->>'targetLabel', 'createdAt', l.data->>'createdAt'))
  from public.admin_audit_logs l
  where (p_cursor_date is null or (l.data->>'createdAt', l.id) < (p_cursor_date, p_cursor_id))
    and (p_actor = '' or l.data->>'actorId' = p_actor)
    and (p_from = '' or left(l.data->>'createdAt',10) >= p_from)
    and (p_to = '' or left(l.data->>'createdAt',10) <= p_to)
    and (coalesce(p_search,'') = '' or strpos(lower(concat_ws(' ', l.data->>'action', l.data->>'targetLabel', l.data->>'targetId', l.data->>'actorId')), lower(btrim(p_search))) > 0)
    and (p_category = 'all' or case
      when l.data->>'action' like 'identity\_%' escape '\' then 'identity'
      when l.data->>'action' like 'subscription\_%' escape '\' or l.data->>'action' like 'trial\_%' escape '\' then 'subscription'
      when l.data->>'action' like 'ticket\_%' escape '\' then 'support'
      when l.data->>'action' like 'community\_%' escape '\' then 'community'
      when l.data->>'action' like 'notification\_%' escape '\' or l.data->>'action' like 'communication\_%' escape '\' then 'notifications'
      when l.data->>'action' like 'commercial\_%' escape '\' or l.data->>'action' like 'followup\_%' escape '\' then 'commercial'
      else 'accounts' end = p_category)
  order by l.data->>'createdAt' desc, l.id desc limit least(greatest(coalesce(p_limit,25),1),51);
end $$;
revoke all on function public.rawdha_admin_audit_page(text,text,text,text,text,text,text,integer) from public, anon;
grant execute on function public.rawdha_admin_audit_page(text,text,text,text,text,text,text,integer) to authenticated;
commit;
