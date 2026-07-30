-- Add messages column to student_leaves for admin-parent chat
ALTER TABLE IF EXISTS public.student_leaves
  ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb;

-- Verify the column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_leaves' AND column_name = 'messages'
  ) THEN
    RAISE EXCEPTION 'Column messages was not added to student_leaves';
  END IF;
END $$;
