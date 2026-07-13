CREATE TABLE IF NOT EXISTS teacher_leaves (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_leave_badals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  leave_id BIGINT REFERENCES teacher_leaves(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT,
  original_teacher_id TEXT NOT NULL,
  badal_teacher_id TEXT NOT NULL,
  badal_teacher_name TEXT,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teacher_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_leave_badals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can insert their own leaves"
  ON teacher_leaves FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Teachers can view their own leaves"
  ON teacher_leaves FOR SELECT
  USING (true);

CREATE POLICY "Admins can update all leaves"
  ON teacher_leaves FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view all leaves"
  ON teacher_leaves FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage leave badals"
  ON teacher_leave_badals FOR ALL
  USING (true);

CREATE POLICY "Teachers can view leave badals"
  ON teacher_leave_badals FOR SELECT
  USING (true);
