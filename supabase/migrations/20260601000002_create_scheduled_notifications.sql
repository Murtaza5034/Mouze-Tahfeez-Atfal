-- Create scheduled_notifications table for daily/weekly/monthly notification scheduling
-- Uses pg_cron to process every 5 minutes

-- Enable pg_net for HTTP calls to Edge Functions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Scheduled notifications table
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'all',
  target_user TEXT,
  redirect_page TEXT DEFAULT 'Home',
  file_url TEXT,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  schedule_time TIME NOT NULL,
  schedule_day INTEGER CHECK (schedule_day IS NULL OR (schedule_day >= 0 AND schedule_day <= 31)),
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast polling
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_next_send
  ON scheduled_notifications (next_send_at)
  WHERE is_active = true;

-- Calculate next occurrence for a schedule
CREATE OR REPLACE FUNCTION calculate_next_send(
  p_schedule_type TEXT,
  p_schedule_time TIME,
  p_schedule_day INTEGER
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_candidate TIMESTAMPTZ;
BEGIN
  -- Start with today at the given time
  v_candidate := date_trunc('day', v_now) + p_schedule_time;

  IF p_schedule_type = 'weekly' THEN
    -- Advance to the correct weekday (0=Sunday)
    WHILE EXTRACT(DOW FROM v_candidate) != p_schedule_day LOOP
      v_candidate := v_candidate + INTERVAL '1 day';
    END LOOP;
  ELSIF p_schedule_type = 'monthly' THEN
    -- Advance to the correct day of month (cap at 28 to avoid month-boundary issues)
    DECLARE
      target_day INT := LEAST(p_schedule_day, 28);
    BEGIN
      WHILE EXTRACT(DAY FROM v_candidate) != target_day LOOP
        v_candidate := v_candidate + INTERVAL '1 day';
      END LOOP;
    END;
  END IF;

  -- If candidate is in the past, move to the next period
  IF v_candidate <= v_now THEN
    IF p_schedule_type = 'daily' THEN
      v_candidate := v_candidate + INTERVAL '1 day';
    ELSIF p_schedule_type = 'weekly' THEN
      v_candidate := v_candidate + INTERVAL '7 days';
    ELSIF p_schedule_type = 'monthly' THEN
      v_candidate := v_candidate + INTERVAL '1 month';
    END IF;
  END IF;

  RETURN v_candidate;
END;
$$ LANGUAGE plpgsql;

-- Process all due scheduled notifications
CREATE OR REPLACE FUNCTION process_scheduled_notifications()
RETURNS TABLE(
  processed_id UUID,
  processed_title TEXT,
  processed_target_role TEXT
) AS $$
DECLARE
  notif RECORD;
  v_now TIMESTAMPTZ := NOW();
  edge_url TEXT := current_setting('supabase_functions.url', true) || '/fcm-notification';
  svc_key TEXT := current_setting('supabase_functions.service_role_key', true);
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
      VALUES (notif.title, notif.body, notif.target_role, notif.target_user, notif.redirect_page, notif.file_url);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to insert system_notification for %: %', notif.id, SQLERRM;
    END;

    -- 2. Send FCM push via Edge Function
    BEGIN
      IF edge_url IS NOT NULL AND svc_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := edge_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || svc_key
          ),
          body := jsonb_build_object(
            'title', notif.title,
            'body', notif.body,
            'targetRole', notif.target_role,
            'targetUser', notif.target_user,
            'data', jsonb_build_object('redirectPage', notif.redirect_page)
          )::text
        );
      END IF;
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

-- Schedule to run every 5 minutes
SELECT cron.schedule(
  'process-scheduled-notifications',
  '*/5 * * * *',
  'SELECT process_scheduled_notifications();'
);

-- ============================================================
-- RLS Policies for scheduled_notifications
-- ============================================================

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user (admin) to read scheduled notifications
CREATE POLICY "Authenticated users can read scheduled notifications"
  ON scheduled_notifications FOR SELECT
  TO authenticated
  USING (true);

-- Allow any authenticated user (admin) to insert scheduled notifications
CREATE POLICY "Authenticated users can insert scheduled notifications"
  ON scheduled_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow any authenticated user (admin) to update scheduled notifications (pause/resume/edit)
CREATE POLICY "Authenticated users can update scheduled notifications"
  ON scheduled_notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow any authenticated user (admin) to delete scheduled notifications
CREATE POLICY "Authenticated users can delete scheduled notifications"
  ON scheduled_notifications FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- Trigger: auto-compute next_send_at on INSERT if not provided
-- ============================================================

CREATE OR REPLACE FUNCTION set_initial_next_send()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-compute if next_send_at is NULL or in the past
  IF NEW.next_send_at IS NULL OR NEW.next_send_at <= NOW() THEN
    NEW.next_send_at := calculate_next_send(NEW.schedule_type, NEW.schedule_time, NEW.schedule_day);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scheduled_notifications_set_next_send
  BEFORE INSERT ON scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_next_send();
