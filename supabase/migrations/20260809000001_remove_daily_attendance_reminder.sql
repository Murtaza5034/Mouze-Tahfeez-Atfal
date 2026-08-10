-- ============================================================================
-- REMOVE THE DAILY ATTENDANCE REMINDER  (teacher pull every minute)
--
-- The attendance-reminder Edge Function ran on a * * * * * cron (every
-- minute, 24/7). Each run downloaded the ENTIRE child_profiles + teacher_
-- profiles + today's attendance via the service role — the single biggest
-- source of the CPU / IO-wait on this project.
--
-- This removes the whole feature:
--   1. Drops the attendance_reminder_state table.
--   2. Un-schedules the 'attendance-reminder' cron job.
--   3. Drops the trigger_attendance_reminder() helper.
--   4. Removes the admin policy (no point on a dropped table).
--
-- All guarded / idempotent — safe to re-run, safe even if parts already gone.
-- ============================================================================

-- 1. Un-schedule the cron job (removes the per-minute DB + Edge function calls).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('attendance-reminder');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not unschedule attendance-reminder (may not exist)';
    END;
  END IF;
END $$;

-- 2. Drop the state table (guarded).
DROP TABLE IF EXISTS public.attendance_reminder_state;

-- 3. Drop the cron trigger helper (guarded).
DROP FUNCTION IF EXISTS public.trigger_attendance_reminder();

-- 4. ANALYZE nothing left to do — end.