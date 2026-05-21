-- Progress card control schema updates
-- Run this in Supabase SQL Editor before deploying the UI changes.

ALTER TABLE public.report_settings
ADD COLUMN IF NOT EXISTS allow_teacher_progress_entry BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reports_live BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS live_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

UPDATE public.report_settings
SET allow_teacher_progress_entry = COALESCE(allow_teacher_progress_entry, true),
    reports_live = COALESCE(reports_live, true)
WHERE id = 1;

INSERT INTO public.report_settings (
  id,
  main_heading,
  sub_heading,
  wusool_heading,
  next_week_heading,
  istifadah_heading,
  reports_live,
  allow_teacher_progress_entry
)
SELECT
  1,
  'Rawdat Tahfeez al Atfal',
  'TAHFEEZ REPORT 1447H',
  'وصول إلى الإذن',
  'Next Week Target',
  'Target Till Istifadah',
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.report_settings WHERE id = 1);

ALTER TABLE public.weekly_results
ADD COLUMN IF NOT EXISTS teacher_edit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS teacher_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS teacher_locked_at TIMESTAMPTZ;

UPDATE public.weekly_results
SET teacher_edit_count = COALESCE(teacher_edit_count, 0),
    teacher_locked = COALESCE(teacher_locked, false)
WHERE teacher_edit_count IS NULL OR teacher_locked IS NULL;
