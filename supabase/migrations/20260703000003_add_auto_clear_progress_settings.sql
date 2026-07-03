-- Add auto-clear progress settings to report_settings
-- Admin can configure day/time to auto-clear teacher marks each week
-- Also provides a manual trigger RPC for immediate clearing

-- 1. Add new columns to report_settings
ALTER TABLE public.report_settings
  ADD COLUMN IF NOT EXISTS auto_clear_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_clear_day TEXT DEFAULT 'Friday',
  ADD COLUMN IF NOT EXISTS auto_clear_time TEXT DEFAULT '11:30';

-- 2. Create/replace the clear_weekly_progress function (no params, used by both cron and manual trigger)
CREATE OR REPLACE FUNCTION clear_weekly_progress()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Check if any records would be affected
  SELECT COUNT(*) INTO v_updated FROM public.weekly_results
  WHERE 
    (wusool_juz IS NOT NULL OR 
     murajazah IS NOT NULL OR 
     juz_hali IS NOT NULL OR 
     takhteet IS NOT NULL OR 
     jadeed IS NOT NULL OR
     total_score IS NOT NULL);

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No teacher marks to clear. All fields are already empty.', 'cleared', 0);
  END IF;

  -- Clear the progress fields
  UPDATE public.weekly_results
  SET
    wusool_juz = NULL,
    wusool_page = NULL,
    matrookah = NULL,
    daeefah = NULL,
    next_week_juz = NULL,
    next_week_page = NULL,
    istifadah_juz = NULL,
    istifadah_page = NULL,
    wusool_surah = NULL,
    next_week_surah = NULL,
    istifadah_surah = NULL,
    murajazah = NULL,
    juz_hali = NULL,
    takhteet = NULL,
    jadeed = NULL,
    total_jadeed_pages = NULL,
    attendance_count = NULL,
    teacher_edit_count = 0,
    teacher_locked = false,
    teacher_locked_at = NULL,
    total_score = NULL
  WHERE 
    (wusool_juz IS NOT NULL OR 
     murajazah IS NOT NULL OR 
     juz_hali IS NOT NULL OR 
     takhteet IS NOT NULL OR 
     jadeed IS NOT NULL OR
     total_score IS NOT NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Successfully cleared ' || v_updated || ' teacher mark record(s). Teachers can now fill new progress marks.',
    'cleared', v_updated
  );
END;
$$;

-- 3. Create a manual trigger RPC for admin to call from the frontend
CREATE OR REPLACE FUNCTION trigger_clear_all_marks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  result := clear_weekly_progress();
  RETURN result;
END;
$$;

-- 4. Create the settings-aware cron check function that respects configured day and time
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
  PERFORM clear_weekly_progress();
END;
$$;

-- Remove old cron job safely (ignore if it doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('weekly-cleanup-friday-430');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Remove any existing auto-clear-progress-check cron to avoid duplicates on re-run
DO $$
BEGIN
  PERFORM cron.unschedule('auto-clear-progress-check');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Schedule new cron job for every 30 minutes to check settings
SELECT cron.schedule(
  'auto-clear-progress-check',
  '*/30 * * * *',
  'SELECT check_settings_and_clear();'
);
