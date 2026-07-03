-- Migration: Add notification broadcast when auto-clear fires
-- Updates check_settings_and_clear() to INSERT a system notification after clearing marks

CREATE OR REPLACE FUNCTION check_settings_and_clear()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_day TEXT;
  v_time TEXT;
  v_current_day_index INTEGER;
  v_configured_day_index INTEGER;
  v_current_minutes INTEGER;
  v_configured_minutes INTEGER;
  v_result JSONB;
  v_cleared_count INTEGER;
BEGIN
  -- Read all auto-clear settings
  SELECT
    auto_clear_enabled,
    auto_clear_day,
    auto_clear_time
  INTO
    v_enabled,
    v_day,
    v_time
  FROM public.report_settings
  WHERE id = 1;

  -- Only proceed if auto-clear is enabled
  IF v_enabled IS NOT TRUE THEN
    RETURN;
  END IF;

  -- Map day names to DOW index (0=Sunday, 1=Monday, ..., 6=Saturday)
  v_configured_day_index := CASE v_day
    WHEN 'Sunday' THEN 0
    WHEN 'Monday' THEN 1
    WHEN 'Tuesday' THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4
    WHEN 'Friday' THEN 5
    WHEN 'Saturday' THEN 6
    ELSE 5
  END;

  -- Check if today matches the configured day
  v_current_day_index := EXTRACT(DOW FROM CURRENT_TIMESTAMP)::INTEGER;
  IF v_current_day_index != v_configured_day_index THEN
    RETURN;
  END IF;

  -- Check if current time is at or past the configured time
  v_current_minutes := EXTRACT(HOUR FROM CURRENT_TIMESTAMP)::INTEGER * 60 + EXTRACT(MINUTE FROM CURRENT_TIMESTAMP)::INTEGER;
  v_configured_minutes := SPLIT_PART(v_time, ':', 1)::INTEGER * 60 + SPLIT_PART(v_time, ':', 2)::INTEGER;
  
  IF v_current_minutes < v_configured_minutes THEN
    RETURN;
  END IF;

  -- All checks passed - clear the marks
  v_result := clear_weekly_progress();
  v_cleared_count := (v_result->>'cleared')::INTEGER;

  -- Broadcast a system notification if records were actually cleared
  IF v_cleared_count > 0 THEN
    INSERT INTO public.system_notifications (title, body, target_role, target_user, redirect_page)
    VALUES (
      'Progress Marks Cleared',
      'All teacher progress marks have been automatically cleared for the new week. Teachers can now fill new marks.',
      'all',
      NULL,
      'Home'
    );
  END IF;
END;
$$;
