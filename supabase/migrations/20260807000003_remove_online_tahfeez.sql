-- ============================================================
-- Remove Online Tahfeez feature (cleanup, idempotent)
-- 1) Drop tahfeez_signals (WebRTC signaling relay)
-- 2) Drop tahfeez_sessions (session audit log)
-- 3) Remove both from the supabase_realtime publication
-- 4) Delete Online Tahfeez page_visibility rows and restore the
--    original role CHECK constraint to ('parents','teacher')
-- ============================================================

-- ---------- 1) Drop signaling table (CASCADE removes policies/indexes) ----------
DROP TABLE IF EXISTS public.tahfeez_signals CASCADE;

-- ---------- 2) Drop audit table ----------
DROP TABLE IF EXISTS public.tahfeez_sessions CASCADE;

-- ---------- 3) Remove from realtime publication if still present ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tahfeez_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.tahfeez_signals;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tahfeez_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.tahfeez_sessions;
  END IF;
END $$;

-- ---------- 4) Clean page_visibility ----------
-- Online Tahfeez was the only feature that wrote role='student' /
-- 'parent' / 'admin' rows (per-student access, parent rows, admin rows).
-- Remove every row those roles produced, plus any orphaned
-- online_tahfeez_* rows, then restore the original constraint.
DELETE FROM public.page_visibility
WHERE role IN ('student', 'parent', 'admin')
   OR page_key LIKE 'online_tahfeez%';

ALTER TABLE public.page_visibility DROP CONSTRAINT IF EXISTS page_visibility_role_check;
ALTER TABLE public.page_visibility
  ADD CONSTRAINT page_visibility_role_check
  CHECK (role IN ('parents', 'teacher'));
