-- Add notification settings columns to jadwal_settings
ALTER TABLE public.jadwal_settings ADD COLUMN IF NOT EXISTS jadwal_notification_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.jadwal_settings ADD COLUMN IF NOT EXISTS jadwal_notification_time TIME DEFAULT '07:00:00';

-- ============================================================
-- Helper: call an Edge Function via pg_net, gracefully handling
-- missing supabase_functions.* database settings.
-- Falls back: service_role_key → anon_key → empty (requires
-- function deployed with --no-verify-jwt).
-- ============================================================
CREATE OR REPLACE FUNCTION call_edge_function(function_path TEXT, body TEXT DEFAULT '{}')
RETURNS void AS $$
DECLARE
  edge_url TEXT;
  svc_key TEXT;
BEGIN
  edge_url := current_setting('supabase_functions.url', true);
  svc_key := current_setting('supabase_functions.service_role_key', true);

  IF edge_url IS NULL THEN
    RAISE WARNING 'call_edge_function: supabase_functions.url is not configured — skipping';
    RETURN;
  END IF;

  IF svc_key IS NULL THEN
    -- Anon key will also work if the function is deployed with --no-verify-jwt
    svc_key := current_setting('supabase_functions.anon_key', true);
  END IF;

  PERFORM net.http_post(
    url := edge_url || function_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(svc_key, '')
    ),
    body := body
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Jadwal-reminder cron (every 15 minutes — function checks if
-- it is time to send within a 15 minute window)
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_jadwal_reminder()
RETURNS void AS $$
BEGIN
  PERFORM call_edge_function('/jadwal-reminder', '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'jadwal-reminder',
  '*/15 * * * *',
  'SELECT trigger_jadwal_reminder();'
);
