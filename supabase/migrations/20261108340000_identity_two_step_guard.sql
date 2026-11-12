-- OCR assists the reviewer; only an administrator can make the final decision.
-- OCR output is bound to the document revision and kept with the private document,
-- so deleting the document on decision also deletes extracted names.
begin;
alter table public.identity_document_reviews add column if not exists auto_match text not null default 'not_checked' check (auto_match in ('not_checked','matched','not_matched','unreadable'));
alter table public.identity_document_reviews add column if not exists auto_checked_at timestamptz;
alter table public.identity_document_reviews add column if not exists auto_document_revision uuid;
alter table public.identity_review_documents add column if not exists ocr_revision uuid not null default gen_random_uuid();
alter table public.identity_review_documents add column if not exists ocr_first_name text;
alter table public.identity_review_documents add column if not exists ocr_last_name text;
alter table public.identity_review_documents add constraint identity_ocr_first_name_length check (ocr_first_name is null or length(ocr_first_name) <= 100);
alter table public.identity_review_documents add constraint identity_ocr_last_name_length check (ocr_last_name is null or length(ocr_last_name) <= 100);

create or replace function public.rawdha_reset_identity_auto_check()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 new.ocr_revision:=gen_random_uuid(); new.ocr_first_name:=null;new.ocr_last_name:=null;
 update public.identity_document_reviews set auto_match='not_checked',auto_checked_at=null,auto_document_revision=null where account_id=new.account_id;
 return new;
end $$;
revoke all on function public.rawdha_reset_identity_auto_check() from public,anon,authenticated;
drop trigger if exists rawdha_identity_auto_reset on public.identity_review_documents;
create trigger rawdha_identity_auto_reset before insert or update of document_bytes,account_first_name,account_last_name,mime_type on public.identity_review_documents for each row execute function public.rawdha_reset_identity_auto_check();

-- Only a trusted service can publish a bounded result. Never trust the browser.
create or replace function public.rawdha_record_identity_auto_result(p_account_id text,p_revision uuid,p_result text,p_first_name text default null,p_last_name text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare doc public.identity_review_documents%rowtype; review_status text; profile jsonb;
begin
 if p_result is null or p_result not in ('matched','not_matched','unreadable') or p_revision is null
   or length(coalesce(p_first_name,''))>100 or length(coalesce(p_last_name,''))>100
   or coalesce(p_first_name,'') ~ '[[:cntrl:]]' or coalesce(p_last_name,'') ~ '[[:cntrl:]]' then raise exception 'invalid_auto_result'; end if;
 select data into profile from public.comptes where id=p_account_id for update;
 select status into review_status from public.identity_document_reviews where account_id=p_account_id for update;
 if review_status is distinct from 'pending' then raise exception 'review_not_pending'; end if;
 select * into doc from public.identity_review_documents where account_id=p_account_id for update;
 if not found or doc.ocr_revision<>p_revision then raise exception 'stale_document'; end if;
 if trim(coalesce(profile->>'prenom',''))<>doc.account_first_name or trim(coalesce(profile->>'nom',''))<>doc.account_last_name then raise exception 'account_name_changed'; end if;
 update public.identity_review_documents set ocr_first_name=nullif(trim(p_first_name),''),ocr_last_name=nullif(trim(p_last_name),'') where account_id=p_account_id;
 update public.identity_document_reviews set auto_match=p_result,auto_checked_at=now(),auto_document_revision=p_revision where account_id=p_account_id;
 -- Still pending regardless of the OCR result; the admin decides.
end $$;
revoke all on function public.rawdha_record_identity_auto_result(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.rawdha_record_identity_auto_result(text,uuid,text,text,text) to service_role;
commit;
