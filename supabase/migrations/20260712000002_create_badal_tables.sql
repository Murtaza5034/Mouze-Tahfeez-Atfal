-- Create badal_assignments table
CREATE TABLE IF NOT EXISTS badal_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  assigned_by TEXT,
  original_teacher_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_badal_assignments_teacher ON badal_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_badal_assignments_student ON badal_assignments(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_badal_assignments_active ON badal_assignments(student_id) WHERE status = 'active';

-- Create badal_progress table
CREATE TABLE IF NOT EXISTS badal_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  juz TEXT,
  juz_hali TEXT,
  jadeed_surah_ayat TEXT,
  week_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_badal_progress_student ON badal_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_badal_progress_teacher ON badal_progress(teacher_id);
CREATE INDEX IF NOT EXISTS idx_badal_progress_week ON badal_progress(week_date);

-- Enable RLS
ALTER TABLE badal_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE badal_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "badal_assignments_all" ON badal_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "badal_progress_all" ON badal_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);
