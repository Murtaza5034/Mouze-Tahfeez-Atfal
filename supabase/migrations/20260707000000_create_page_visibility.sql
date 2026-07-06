-- Create page_visibility table for role-based page hiding
-- Admin can toggle visibility of portal pages for parents and teacher roles

CREATE TABLE IF NOT EXISTS page_visibility (
  id BIGSERIAL PRIMARY KEY,
  page_key TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parents', 'teacher')),
  label TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_key, role)
);

CREATE INDEX IF NOT EXISTS idx_page_visibility_role ON page_visibility (role);

ALTER TABLE page_visibility ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Anyone can read page_visibility"
  ON page_visibility
  FOR SELECT
  USING (true);

-- Authenticated users can insert/update/delete (app-level admin guard)
CREATE POLICY "Authenticated can manage page_visibility"
  ON page_visibility
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ========================
-- SEED DATA: All portal pages (visible by default)
-- ========================

INSERT INTO page_visibility (page_key, role, label, visible) VALUES

-- ===== PARENTS PORTAL PAGES =====
('Home', 'parents', 'Home', true),
('Profile', 'parents', 'My Profile', true),
('Child Summary', 'parents', 'Progress', true),
('Policy', 'parents', 'Policy', true),
('Schedule', 'parents', 'Schedule', true),
('Teachers', 'parents', 'Teachers', true),
('Inbox', 'parents', 'Inbox', true),
('Hub Raqam', 'parents', 'Hub Raqam', true),
('Apply Leave', 'parents', 'Apply Leave', true),
('Jadwal', 'parents', 'Jadwal', true),
('Self Jadwal', 'parents', 'Self Jadwal', true),
('Marhala Posts', 'parents', 'Marhala Posts', true),
('Settings', 'parents', 'Settings', true),

-- ===== TEACHER PORTAL PAGES =====
('My Group', 'teacher', 'Students', true),
('Fill Result', 'teacher', 'Mark Progress', true),
('Overview', 'teacher', 'Performance', true),
('Jadwal', 'teacher', 'Jadwal', true),
('Self Jadwal', 'teacher', 'Self Jadwal', true),
('Inbox', 'teacher', 'Inbox', true),
('Settings', 'teacher', 'Settings', true);
