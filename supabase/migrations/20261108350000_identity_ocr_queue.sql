-- Queue is accessible only to the trusted OCR worker, and never to browsers.
begin;
create or replace function public.rawdha_identity_ocr_queue()
returns table(account_id text, ocr_revision uuid, account_first_name text, account_last_name text, document_bytes bytea)
language sql security definer stable set search_path=public,pg_temp as $$
 select d.account_id,d.ocr_revision,d.account_first_name,d.account_last_name,d.document_bytes
 from public.identity_document_reviews r
 join public.identity_review_documents d on d.account_id=r.account_id
 join public.comptes c on c.id=r.account_id
 where r.status='pending' and r.auto_match='not_checked'
   and trim(coalesce(c.data->>'prenom',''))=d.account_first_name
   and trim(coalesce(c.data->>'nom',''))=d.account_last_name
 order by r.submitted_at nulls last, r.account_id limit 10
$$;
revoke all on function public.rawdha_identity_ocr_queue() from public,anon,authenticated;
grant execute on function public.rawdha_identity_ocr_queue() to service_role;
commit;
