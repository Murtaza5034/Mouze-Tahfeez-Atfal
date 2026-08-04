-- ============================================================
-- PREMIUM TEACHER LEAVE UPGRADE
-- Adds leave categories, miqaat/event references, and a
-- "subject_to_approve" interim status so admins can mark a
-- teacher leave as pending-review before final approve/reject.
-- ============================================================

-- Category (why / what type of leave) and optional event reference
ALTER TABLE teacher_leaves
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

ALTER TABLE teacher_leaves
  ADD COLUMN IF NOT EXISTS event_id BIGINT;

ALTER TABLE teacher_leaves
  ADD COLUMN IF NOT EXISTS event_name TEXT;

-- Extend the allowed status values to include subject_to_approve
ALTER TABLE teacher_leaves
  DROP CONSTRAINT IF EXISTS teacher_leaves_status_check;

ALTER TABLE teacher_leaves
  ADD CONSTRAINT teacher_leaves_status_check
  CHECK (status IN ('pending', 'approve_review', 'approved', 'rejected', 'subject_to_approve'));