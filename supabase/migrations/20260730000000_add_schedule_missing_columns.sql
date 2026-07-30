-- Add missing columns to the schedule table for the premium schedule creation feature
-- schedule_date: stores the date the task is scheduled for (YYYY-MM-DD)
-- task_body: stores the admin's message/notes for parents
-- ikhtebar_type: stores the type of test (murajah, juz_hali, takhteet, jadeed, or custom)

ALTER TABLE IF EXISTS public.schedule
  ADD COLUMN IF NOT EXISTS schedule_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS task_body TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ikhtebar_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS marhala TEXT DEFAULT '';
