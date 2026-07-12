-- Add badal columns directly to child_profiles
-- This replaces the separate badal_assignments table approach.
-- original_teacher_id: the child's permanent teacher (set once, never changes unless admin changes it)
-- badal_teacher_id: the substitute teacher (can be updated from Badal Update page, can be NULL)

ALTER TABLE child_profiles
ADD COLUMN IF NOT EXISTS original_teacher_id TEXT,
ADD COLUMN IF NOT EXISTS badal_teacher_id TEXT;

-- Migrate existing badal_assignments data into child_profiles
-- For any active badal assignment, set badal_teacher_id and original_teacher_id
UPDATE child_profiles cp
SET
  badal_teacher_id = ba.teacher_id,
  original_teacher_id = COALESCE(cp.original_teacher_id, ba.original_teacher_id)
FROM badal_assignments ba
WHERE
  ba.status = 'active'
  AND ba.student_id = cp.student_id::TEXT;
