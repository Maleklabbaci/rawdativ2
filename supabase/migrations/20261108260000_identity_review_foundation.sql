-- Private manual document review, independent of signup or account approval.
-- Status is separate from account approval and from user-editable profile data.
begin;
create table if not exists public.identity_document_reviews (
  account_id text primary key references public.comptes(id) on delete cascade,
  status text not null default 'unverified' check (status in ('unverified', 'pending', 'document_reviewed', 'refused')),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by text references public.comptes(id) on delete set null,
  constraint identity_review_decision_consistent check (
    (status in ('unverified', 'pending') and decided_at is null and decided_by is null)
    or (status in ('document_reviewed', 'refused') and decided_at is not null)
  )
);
alter table public.identity_document_reviews enable row level security;
revoke all on public.identity_document_reviews from public, anon, authenticated;
grant select on public.identity_document_reviews to authenticated;
drop policy if exists identity_review_read on public.identity_document_reviews;
create policy identity_review_read on public.identity_document_reviews for select to authenticated
  using (account_id = auth.uid()::text or coalesce(public.rawdha_is_admin(), false));
-- The document never appears in the status table or in a client-readable view.
create table if not exists public.identity_review_documents (
  account_id text primary key references public.identity_document_reviews(account_id) on delete cascade,
  account_first_name text not null,
  account_last_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  document_bytes bytea not null check (octet_length(document_bytes) between 1 and 2097152)
);
alter table public.identity_review_documents enable row level security;
revoke all on public.identity_review_documents from public, anon, authenticated;
grant select on public.identity_review_documents to service_role;
grant select on public.identity_document_reviews to service_role;

-- Service only; the account id comes from an authenticated request in the edge function.
create or replace function public.rawdha_submit_identity_document(p_account_id text, p_mime text, p_base64 text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare profile jsonb; first_name text; last_name text; payload bytea; current_status text;
begin
  select data into profile from public.comptes where id = p_account_id and data->>'role' = 'directeur' for update;
  if profile is null then raise exception 'account_unavailable'; end if;
  first_name := trim(coalesce(profile->>'prenom','')); last_name := trim(coalesce(profile->>'nom',''));
  if first_name = '' or last_name = '' then raise exception 'account_name_missing'; end if;
  if p_mime not in ('image/jpeg','image/png') or length(p_base64) > 2796204 then raise exception 'invalid_document'; end if;
  payload := decode(p_base64, 'base64');
  if octet_length(payload) = 0 or octet_length(payload) > 2097152 then raise exception 'invalid_document'; end if;
  select status into current_status from public.identity_document_reviews where account_id = p_account_id for update;
  if current_status = 'pending' then raise exception 'review_already_pending'; end if;
  insert into public.identity_document_reviews(account_id, status, submitted_at, decided_at, decided_by)
    values (p_account_id, 'pending', now(), null, null)
    on conflict (account_id) do update set status = 'pending', submitted_at = now(), decided_at = null, decided_by = null;
  insert into public.identity_review_documents(account_id, account_first_name, account_last_name, mime_type, document_bytes)
    values (p_account_id, first_name, last_name, p_mime, payload)
    on conflict (account_id) do update set account_first_name = excluded.account_first_name, account_last_name = excluded.account_last_name,
      mime_type = excluded.mime_type, document_bytes = excluded.document_bytes;
end $$;

-- Deletion and decision are one database transaction. Never retain an approved/rejected card in the active table.
create or replace function public.rawdha_decide_identity_document(p_account_id text, p_admin_id text, p_decision text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare current_status text; profile jsonb; doc public.identity_review_documents%rowtype;
begin
  if p_decision not in ('document_reviewed','refused') then raise exception 'invalid_decision'; end if;
  if not exists(select 1 from public.comptes where id = p_admin_id and data->>'role' = 'admin') then raise exception 'admin_required'; end if;
  select status into current_status from public.identity_document_reviews where account_id = p_account_id for update;
  if current_status is distinct from 'pending' then raise exception 'review_not_pending'; end if;
  select * into doc from public.identity_review_documents where account_id = p_account_id for update;
  if not found then raise exception 'document_unavailable'; end if;
  select data into profile from public.comptes where id = p_account_id for update;
  if p_decision = 'document_reviewed' and (trim(coalesce(profile->>'prenom','')) <> doc.account_first_name or trim(coalesce(profile->>'nom','')) <> doc.account_last_name) then
    raise exception 'account_name_changed';
  end if;
  delete from public.identity_review_documents where account_id = p_account_id;
  update public.identity_document_reviews set status = p_decision, decided_at = now(), decided_by = p_admin_id where account_id = p_account_id;
end $$;
revoke all on function public.rawdha_submit_identity_document(text,text,text) from public, anon, authenticated;
revoke all on function public.rawdha_decide_identity_document(text,text,text) from public, anon, authenticated;
grant execute on function public.rawdha_submit_identity_document(text,text,text) to service_role;
grant execute on function public.rawdha_decide_identity_document(text,text,text) to service_role;
-- Only the minimal badge information is visible to authenticated users.
create or replace function public.rawdha_reviewed_document_accounts()
returns table(account_id text) language sql security definer stable set search_path = public, pg_temp as $$
  select r.account_id from public.identity_document_reviews r where r.status = 'document_reviewed'
$$;
revoke all on function public.rawdha_reviewed_document_accounts() from public, anon;
grant execute on function public.rawdha_reviewed_document_accounts() to authenticated;

-- A changed account name invalidates the reviewed label, even for old clients.
create or replace function public.rawdha_invalidate_identity_review_on_name_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (new.data->>'nom', new.data->>'prenom') is distinct from (old.data->>'nom', old.data->>'prenom') then
    update public.identity_document_reviews set status = 'unverified', submitted_at = null, decided_at = null, decided_by = null
      where account_id = new.id and status = 'document_reviewed';
  end if;
  return new;
end $$;
revoke all on function public.rawdha_invalidate_identity_review_on_name_change() from public, anon, authenticated;
drop trigger if exists rawdha_identity_name_change on public.comptes;
create trigger rawdha_identity_name_change after update of data on public.comptes
for each row execute function public.rawdha_invalidate_identity_review_on_name_change();
commit;
