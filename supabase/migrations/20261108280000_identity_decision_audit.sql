-- Record a manual document decision in the same transaction as the review.
-- Never copy the document, notes, or account name into the audit record.
begin;
create or replace function public.rawdha_audit_identity_decision()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare event_id text; action_name text;
begin
  if old.status = 'pending' and new.status in ('document_reviewed', 'refused')
     and new.decided_by is not null and new.decided_at is not null then
    if not exists (select 1 from public.comptes where id = new.decided_by and data->>'role' = 'admin') then
      raise exception 'admin_required';
    end if;
    action_name := case when new.status = 'document_reviewed' then 'identity_document_reviewed' else 'identity_document_refused' end;
    event_id := 'audit_' || md5(clock_timestamp()::text || random()::text || new.account_id || action_name);
    insert into public.admin_audit_logs(id, data) values (event_id, jsonb_build_object(
      'id', event_id, 'actorId', new.decided_by, 'action', action_name,
      'targetType', 'director_account', 'targetId', new.account_id,
      'createdAt', now()::text
    ));
  end if;
  return new;
end $$;
revoke all on function public.rawdha_audit_identity_decision() from public, anon, authenticated;
drop trigger if exists rawdha_identity_decision_audit on public.identity_document_reviews;
create trigger rawdha_identity_decision_audit after update of status on public.identity_document_reviews
for each row execute function public.rawdha_audit_identity_decision();
commit;
