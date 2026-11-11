-- Staging only, not deployed. The existing browser deletion uses several
-- independent requests and can leave orphaned rows or destroy financial history.
-- Pause direct API deletion until a retention-aware, transactional workflow and
-- its dependencies have been designed and tested. Archiving remains an UPDATE.
-- Privileged functions and service-role operations require separate auditing.
begin;
revoke delete on table public.enfants from public, anon, authenticated;
commit;
