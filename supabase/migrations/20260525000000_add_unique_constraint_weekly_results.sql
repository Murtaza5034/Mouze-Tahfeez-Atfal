-- Add unique constraint on (student_id, week_date) to weekly_results
-- This enables upsert operations using onConflict: "student_id,week_date"
-- Without it, saving progress on MarkProgress fails with:
-- [42P10] there is no unique or exclusion constraint matching the ON CONFLICT specification

-- First, clean up any duplicate records keeping only the most recent one
DELETE FROM public.weekly_results
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT ctid,
           ROW_NUMBER() OVER (
             PARTITION BY student_id, week_date
             ORDER BY created_at DESC NULLS LAST
           ) AS rn
    FROM public.weekly_results
  ) dup
  WHERE dup.rn > 1
);

-- Then add the unique constraint
ALTER TABLE public.weekly_results
ADD CONSTRAINT weekly_results_student_id_week_date_key
UNIQUE (student_id, week_date);
