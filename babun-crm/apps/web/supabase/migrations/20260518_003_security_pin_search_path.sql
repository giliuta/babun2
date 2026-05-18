-- 20260518_003 — Pin search_path on remaining mutable functions
--                 (Supabase advisor §F-AUTH-3)
--
-- Three trigger functions still had a mutable search_path, which lets
-- a malicious schema (search_path injection) shadow built-ins. Pin
-- each to the empty path; their bodies fully-qualify references.
--
-- After this migration the Supabase advisor will drop the 3 remaining
-- `function_search_path_mutable` WARN lines.

alter function public.set_updated_at() set search_path = '';
alter function public.touch_event_template_updated_at() set search_path = '';
alter function public.check_max_photos() set search_path = '';
