-- Weekly cleanup of teacher-filled progress values
-- Runs every Friday at 4:30 AM (Asia/Karachi timezone)
-- Clears the progress fields in weekly_results so teachers start fresh each week
-- Keeps attendance data, notes, and other non-progress fields intact

CREATE OR REPLACE FUNCTION clear_weekly_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE weekly_results
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
    -- Only clear records that have teacher-filled progress
    (wusool_juz IS NOT NULL OR 
     murajazah IS NOT NULL OR 
     juz_hali IS NOT NULL OR 
     takhteet IS NOT NULL OR 
     jadeed IS NOT NULL);
END;
$$;

-- Schedule the cleanup: every Friday at 4:30 AM
-- cron expression: 30 4 * * 5  (minute=30, hour=4, day-of-week=5=Friday)
SELECT cron.schedule(
  'weekly-cleanup-friday-430',
  '30 4 * * 5',
  'SELECT clear_weekly_progress();'
);
