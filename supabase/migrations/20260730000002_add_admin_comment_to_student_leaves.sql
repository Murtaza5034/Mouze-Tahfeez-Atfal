-- Add admin_comment column to student_leaves for approval messages
ALTER TABLE IF EXISTS public.student_leaves
  ADD COLUMN IF NOT EXISTS admin_comment TEXT;

-- Verify the column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_leaves' AND column_name = 'admin_comment'
  ) THEN
    RAISE EXCEPTION 'Column admin_comment was not added to student_leaves';
  END IF;
END $$;
