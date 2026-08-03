-- ============================================================
-- Result Live notifications — premium toggle + server-side
-- scheduled notifier for parents & teachers.
--
-- Adds to report_settings:
--   result_live_notify_enabled  BOOLEAN  — admin premium toggle.
--      When ON, the admin can send ("Send Notify") and the
--      scheduled notifier fires automatically when the saved
--      live time arrives.
--   result_live_last_notified_at TIMESTAMPTZ — dedup marker so
--      the scheduled notifier only fires once per live schedule.
--
-- Registers a pg_cron job (every 2 minutes) that calls the
-- `result-live-notifier` Edge Function (must be deployed with
-- --no-verify-jwt, same as attendance-reminder).
-- ============================================================

ALTER TABLE public.report_settings
  ADD COLUMN IF NOT EXISTS result_live_notify_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS result_live_last_notified_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- Cron trigger: calls the result-live-notifier edge function.
-- call_edge_function() was created in
-- 20260605000002_fix_scheduled_notifications_auth.sql
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_result_live_notifier()
RETURNS void AS $$
BEGIN
  PERFORM call_edge_function('/result-live-notifier', '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('result-live-notifier');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not unschedule result-live-notifier (may not exist)';
    END;

    PERFORM cron.schedule(
      'result-live-notifier',
      '*/2 * * * *',
      'SELECT trigger_result_live_notifier();'
    );
  END IF;
END $$;
