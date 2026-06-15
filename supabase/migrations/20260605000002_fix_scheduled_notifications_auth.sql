-- ============================================================
-- Fix: pg_cron calls to Edge Functions now use call_edge_function()
-- which gracefully handles missing supabase_functions.* settings.
-- Functions must be deployed with --no-verify-jwt.
-- ============================================================

-- Helper: call an Edge Function via pg_net, gracefully handling
-- missing supabase_functions.* database settings.
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

-- Recreate process_scheduled_notifications to use the robust helper
CREATE OR REPLACE FUNCTION process_scheduled_notifications()
RETURNS TABLE(
  processed_id UUID,
  processed_title TEXT,
  processed_target_role TEXT
) AS $$
DECLARE
  notif RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  FOR notif IN
    SELECT * FROM scheduled_notifications
    WHERE is_active = true
      AND next_send_at IS NOT NULL
      AND next_send_at <= v_now
    ORDER BY next_send_at ASC
    LIMIT 50
  LOOP
    -- 1. Insert into system_notifications for in-app inbox
    BEGIN
      INSERT INTO system_notifications (title, body, target_role, target_user, redirect_page, file_url)
      VALUES (notif.title, COALESCE(notif.body, ''), notif.target_role, notif.target_user, notif.redirect_page, notif.file_url);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to insert system_notification for %: %', notif.id, SQLERRM;
    END;

    -- 2. Send FCM push via Edge Function (using robust helper)
    BEGIN
      PERFORM call_edge_function(
        '/fcm-notification',
        jsonb_build_object(
          'title', notif.title,
          'body', notif.body,
          'targetRole', notif.target_role,
          'targetUser', notif.target_user,
          'data', jsonb_build_object('redirectPage', notif.redirect_page)
        )::text
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'FCM push failed for scheduled notification %: %', notif.id, SQLERRM;
    END;

    -- 3. Update last_sent_at and compute next_send_at
    UPDATE scheduled_notifications
    SET
      last_sent_at = v_now,
      next_send_at = calculate_next_send(notif.schedule_type, notif.schedule_time, notif.schedule_day),
      updated_at = v_now
    WHERE id = notif.id;

    processed_id := notif.id;
    processed_title := notif.title;
    processed_target_role := notif.target_role;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also recreate trigger_jadwal_reminder (if the previous migration
-- was already applied, this ensures it uses call_edge_function)
CREATE OR REPLACE FUNCTION trigger_jadwal_reminder()
RETURNS void AS $$
BEGIN
  PERFORM call_edge_function('/jadwal-reminder', '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
