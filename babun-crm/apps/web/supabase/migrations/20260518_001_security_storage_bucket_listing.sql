-- 20260518_001 — Storage bucket listing cleanup (Supabase advisor §F-SEC-1)
--
-- Two public buckets had policies that let anon/authenticated LIST
-- files across the entire bucket (no tenant scope). Public `<img>`
-- URLs work via the /public/ endpoint regardless of RLS, so we can
-- tighten LIST/SELECT to tenant scope without breaking image display.
--
-- 1. `avatars` — legacy bucket created 2026-04-08 with a single
--    FOR ALL policy on `{}` (all roles). No code references this
--    bucket anywhere. Drop the wide-open policy entirely; bucket
--    itself stays public so any historical image URL still resolves
--    via /storage/v1/object/public/avatars/…
--
-- 2. `client-avatars` — current code stores files at
--    `client-avatars/{tenant_id}/{client_id}.{ext}`. The existing
--    SELECT policy was just `bucket_id = 'client-avatars'` granted
--    to {authenticated, anon}, which means anyone (signed-in or not)
--    could enumerate every file across every tenant via the LIST
--    endpoint. Replace with a tenant-scoped SELECT for authenticated.
--    Anon read continues to work via the public file URL.

-- A. Drop the dangerous wide-open `avatars` policy.
drop policy if exists storage_avatars on storage.objects;

-- B. Tighten client-avatars SELECT to tenant-scoped.
drop policy if exists client_avatars_select on storage.objects;

create policy client_avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-avatars'
    and (storage.foldername(name))[1] = (current_tenant_id())::text
  );
