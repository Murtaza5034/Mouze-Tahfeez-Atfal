-- Migration: Create teacher_unlock_logs table for audit trail
-- Records each time an admin unlocks a teacher's progress edit limit

CREATE TABLE IF NOT EXISTS teacher_unlock_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id BIGINT NOT NULL,
  teacher_name TEXT NOT NULL,
  admin_user_id UUID NOT NULL,
  admin_name TEXT DEFAULT '',
  affected_results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_teacher_unlock_teacher_id ON teacher_unlock_logs(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_unlock_admin_id ON teacher_unlock_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_unlock_created_at ON teacher_unlock_logs(created_at);

-- Enable Row Level Security
ALTER TABLE teacher_unlock_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to read logs
CREATE POLICY "Admins can read teacher_unlock_logs"
  ON teacher_unlock_logs FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_portal_access 
      WHERE portal_role = 'admin' AND is_active = true
    )
  );

-- Allow admins to insert logs
CREATE POLICY "Admins can insert teacher_unlock_logs"
  ON teacher_unlock_logs FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM user_portal_access 
      WHERE portal_role = 'admin' AND is_active = true
    )
  );
