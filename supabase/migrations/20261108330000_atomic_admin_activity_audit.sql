-- Audit only administrative actions and only fixed fields. Events and writes share a transaction.
begin;
create or replace function public.rawdha_audit_admin_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare actions text[] := array[]::text[]; action_name text; target_type text; target_id text; v_id text; actor text:=auth.uid()::text;
begin
 if actor is null or not coalesce(public.rawdha_is_admin(), false) then
   if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_table_name='signalements' then
   target_type:='ticket'; target_id:=case when tg_op='DELETE' then old.id else new.id end;
   if tg_op='DELETE' then actions:=array['ticket_deleted'];
   elsif tg_op='UPDATE' then
     if old.data->'statut' is distinct from new.data->'statut' then actions:=array_append(actions,'ticket_status_updated'); end if;
     if old.data->'reponseAdmin' is distinct from new.data->'reponseAdmin' then actions:=array_append(actions,'ticket_response_saved'); end if;
     if old.data->'assigneeId' is distinct from new.data->'assigneeId' or old.data->'assigneeName' is distinct from new.data->'assigneeName' then actions:=array_append(actions,'ticket_assigned'); end if;
     if old.data->'priorite' is distinct from new.data->'priorite' then actions:=array_append(actions,'ticket_priority_updated'); end if;
     if old.data->'dueAt' is distinct from new.data->'dueAt' then actions:=array_append(actions,'ticket_due_date_updated'); end if;
   end if;
 elsif tg_table_name='notifications' and tg_op='DELETE' then target_type:='notification';target_id:=old.id;actions:=array['notification_deleted'];
 elsif tg_table_name='community_posts' and tg_op='UPDATE' then
   target_type:='community_post';target_id:=new.id;
   if old.data->>'statut' is distinct from new.data->>'statut' and new.data->>'statut' in ('masquee','publie') then actions:=array[case when new.data->>'statut'='masquee' then 'community_post_hidden' else 'community_post_restored' end];end if;
 elsif tg_table_name='community_features' then
   target_type:='community_post';
   if tg_op='INSERT' and new.data->>'kind'='pin' then target_id:=new.data->>'targetId';actions:=array['community_post_pinned'];
   elsif tg_op='DELETE' and old.data->>'kind'='pin' then target_id:=old.data->>'targetId';actions:=array['community_post_unpinned'];end if;
 end if;
 if coalesce(target_id,'')<>'' then
   foreach action_name in array actions loop
     v_id:='audit_'||md5(clock_timestamp()::text||random()::text||actor||action_name||target_id);
     insert into public.admin_audit_logs(id,data) values(v_id,jsonb_build_object('id',v_id,'actorId',actor,'action',action_name,'targetType',target_type,'targetId',target_id,'createdAt',now()::text));
   end loop;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.rawdha_audit_admin_mutation() from public,anon,authenticated;
drop trigger if exists rawdha_audit_signalements on public.signalements;
create trigger rawdha_audit_signalements after update or delete on public.signalements for each row execute function public.rawdha_audit_admin_mutation();
drop trigger if exists rawdha_audit_notification_delete on public.notifications;
create trigger rawdha_audit_notification_delete after delete on public.notifications for each row execute function public.rawdha_audit_admin_mutation();
drop trigger if exists rawdha_audit_community_post on public.community_posts;
create trigger rawdha_audit_community_post after update on public.community_posts for each row execute function public.rawdha_audit_admin_mutation();
drop trigger if exists rawdha_audit_community_pin on public.community_features;
create trigger rawdha_audit_community_pin after insert or delete on public.community_features for each row execute function public.rawdha_audit_admin_mutation();
commit;
