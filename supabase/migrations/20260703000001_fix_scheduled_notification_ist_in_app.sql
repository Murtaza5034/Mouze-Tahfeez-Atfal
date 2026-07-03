-- Fix scheduled notification recurrence:
-- - schedule_time is entered by admins as IST wall-clock time
-- - next_send_at must be stored as UTC timestamptz for that IST time

CREATE OR REPLACE FUNCTION calculate_next_send(
  p_schedule_type TEXT,
  p_schedule_time TIME,
  p_schedule_day INTEGER
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_local_now TIMESTAMP := NOW() AT TIME ZONE 'Asia/Kolkata';
  v_local_candidate TIMESTAMP;
BEGIN
  v_local_candidate := date_trunc('day', v_local_now) + p_schedule_time;

  IF p_schedule_type = 'weekly' THEN
    WHILE EXTRACT(DOW FROM v_local_candidate) != p_schedule_day LOOP
      v_local_candidate := v_local_candidate + INTERVAL '1 day';
    END LOOP;
  ELSIF p_schedule_type = 'monthly' THEN
    DECLARE
      target_day INT := LEAST(p_schedule_day, 28);
    BEGIN
      WHILE EXTRACT(DAY FROM v_local_candidate) != target_day LOOP
        v_local_candidate := v_local_candidate + INTERVAL '1 day';
      END LOOP;
    END;
  END IF;

  IF (v_local_candidate AT TIME ZONE 'Asia/Kolkata') <= v_now THEN
    IF p_schedule_type = 'daily' THEN
      v_local_candidate := v_local_candidate + INTERVAL '1 day';
    ELSIF p_schedule_type = 'weekly' THEN
      v_local_candidate := v_local_candidate + INTERVAL '7 days';
    ELSIF p_schedule_type = 'monthly' THEN
      v_local_candidate := v_local_candidate + INTERVAL '1 month';
    END IF;
  END IF;

  RETURN v_local_candidate AT TIME ZONE 'Asia/Kolkata';
END;
$$ LANGUAGE plpgsql;

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
    INSERT INTO system_notifications (title, body, target_role, target_user, redirect_page, file_url)
    VALUES (notif.title, COALESCE(notif.body, ''), notif.target_role, notif.target_user, notif.redirect_page, notif.file_url);

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

UPDATE scheduled_notifications
SET
  next_send_at = calculate_next_send(schedule_type, schedule_time, schedule_day),
  updated_at = NOW()
WHERE is_active = true;
