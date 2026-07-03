-- Create self_jadawal table for Self Jadwal feature
-- This stores personal Quran study schedules for parents/users

CREATE TABLE IF NOT EXISTS self_jadawal (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE self_jadawal ENABLE ROW LEVEL SECURITY;

-- Policy: users can view their own self jadwal
CREATE POLICY "Users can view own self_jadawal"
  ON self_jadawal
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: users can insert their own self jadwal
CREATE POLICY "Users can insert own self_jadawal"
  ON self_jadawal
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can update their own self jadwal
CREATE POLICY "Users can update own self_jadawal"
  ON self_jadawal
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: teachers can view all self jadawal
CREATE POLICY "Teachers can view self_jadawal"
  ON self_jadawal
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_portal_access
      WHERE user_id = auth.uid()
        AND portal_role = 'teacher'
    )
  );

-- Policy: teachers can insert/update self jadawal
CREATE POLICY "Teachers can upsert self_jadawal"
  ON self_jadawal
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_portal_access
      WHERE user_id = auth.uid()
        AND portal_role = 'teacher'
    )
  );

CREATE POLICY "Teachers can update self_jadawal"
  ON self_jadawal
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_portal_access
      WHERE user_id = auth.uid()
        AND portal_role = 'teacher'
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_self_jadawal_user_id ON self_jadawal(user_id);
