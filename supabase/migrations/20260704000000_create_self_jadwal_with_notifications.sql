-- Create self_jadwal table for Self Jadwal feature with notification tracking
-- This stores personal Quran study schedules for parents/users

CREATE TABLE IF NOT EXISTS self_jadwal (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_by UUID REFERENCES auth.users(id),
  has_unseen_changes BOOLEAN NOT NULL DEFAULT false,
  teacher_updated_at TIMESTAMPTZ,
  parent_viewed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE self_jadwal ENABLE ROW LEVEL SECURITY;

-- Policy: users can view their own self jadwal
CREATE POLICY "Users can view own self_jadwal"
  ON self_jadwal
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: users can insert their own self jadwal
CREATE POLICY "Users can insert own self_jadwal"
  ON self_jadwal
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can update their own self jadwal
CREATE POLICY "Users can update own self_jadwal"
  ON self_jadwal
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: teachers can view all self jadwal
CREATE POLICY "Teachers can view self_jadwal"
  ON self_jadwal
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_portal_access
      WHERE user_id = auth.uid()
        AND portal_role = 'teacher'
    )
  );

-- Policy: teachers can insert/update self jadwal
CREATE POLICY "Teachers can upsert self_jadwal"
  ON self_jadwal
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_portal_access
      WHERE user_id = auth.uid()
        AND portal_role = 'teacher'
    )
  );

CREATE POLICY "Teachers can update self_jadwal"
  ON self_jadwal
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_portal_access
      WHERE user_id = auth.uid()
        AND portal_role = 'teacher'
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_self_jadwal_user_id ON self_jadwal(user_id);
CREATE INDEX IF NOT EXISTS idx_self_jadwal_has_unseen_changes ON self_jadwal(has_unseen_changes);

-- Create table to track notification dismissals (one-time popup)
CREATE TABLE IF NOT EXISTS self_jadwal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL DEFAULT 'welcome',
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

-- Enable RLS for notifications
ALTER TABLE self_jadwal_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: users can manage their own notifications
CREATE POLICY "Users can manage own self_jadwal_notifications"
  ON self_jadwal_notifications
  FOR ALL
  USING (auth.uid() = user_id);

-- Index for notifications
CREATE INDEX IF NOT EXISTS idx_self_jadwal_notifications_user_id ON self_jadwal_notifications(user_id);

-- Function to update has_unseen_changes when teacher updates
CREATE OR REPLACE FUNCTION trigger_mark_teacher_update()
RETURNS TRIGGER AS $$
DECLARE
  is_teacher BOOLEAN;
BEGIN
  -- Check if current user is a teacher
  SELECT EXISTS (
    SELECT 1 FROM user_portal_access
    WHERE user_id = auth.uid()
      AND portal_role = 'teacher'
  ) INTO is_teacher;

  IF NEW.updated_at != OLD.updated_at AND is_teacher THEN
    NEW.last_updated_by = auth.uid();
    NEW.teacher_updated_at = NOW();
    NEW.has_unseen_changes = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to mark teacher updates (runs on every update, checks teacher status inside function)
CREATE TRIGGER on_self_jadwal_teacher_update
  AFTER UPDATE ON self_jadwal
  FOR EACH ROW
  EXECUTE FUNCTION trigger_mark_teacher_update();
