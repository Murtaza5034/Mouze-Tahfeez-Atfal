-- ============================================================
-- Attendance reminder — server-side scheduled notifications
-- Sends daily attendance summary to teachers Mon-Sat at 10:00 PM IST
-- via the `attendance-reminder` Edge Function.
-- Replaces the old client-side (browser-only) reminder that only
-- fired while an admin had the app open.
-- ============================================================

-- Enable pg_cron / pg_net if not already available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Dedup state table (single row id=1)
CREATE TABLE IF NOT EXISTS public.attendance_reminder_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.attendance_reminder_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Service role (edge function) can read/update the state
ALTER TABLE public.attendance_reminder_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages attendance reminder state" ON public.attendance_reminder_state;
CREATE POLICY "Service role manages attendance reminder state"
  ON public.attendance_reminder_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Cron trigger: calls the attendance-reminder edge function.
-- Runs every minute — the function itself checks the exact IST time
-- (10:05 PM IST, Mon-Sat) and dedups per day.
-- call_edge_function() was created in
-- 20260605000001_add_jadwal_notification_settings.sql
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_attendance_reminder()
RETURNS void AS $$
BEGIN
  PERFORM call_edge_function('/attendance-reminder', '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('attendance-reminder');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not unschedule attendance-reminder (may not exist)';
    END;

    PERFORM cron.schedule(
      'attendance-reminder',
      '* * * * *',
      'SELECT trigger_attendance_reminder();'
    );
  END IF;
END $$;
