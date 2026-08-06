-- ============================================================
-- Online Tahfeez Premium Fix
-- 1) Allow student/parent roles in page_visibility so individual
--    student access and parent rows persist to the database.
-- 2) Create tahfeez_sessions for completed session audit logs.
-- 3) Create tahfeez_signals for reliable WebRTC signaling (offer /
--    answer / ice) with realtime delivery + poll fallback.
-- ============================================================

-- ---------- 1) page_visibility role CHECK fix ----------
-- The old constraint only allowed ('parents','teacher'). The app also
-- stores per-student rows (role 'student') and parent rows (role 'parent'),
-- so those inserts were silently failing.
ALTER TABLE public.page_visibility DROP CONSTRAINT IF EXISTS page_visibility_role_check;
ALTER TABLE public.page_visibility
  ADD CONSTRAINT page_visibility_role_check
  CHECK (role IN ('parents', 'teacher', 'student', 'parent', 'admin'));

-- ---------- 2) tahfeez_sessions (audit log) ----------
CREATE TABLE IF NOT EXISTS public.tahfeez_sessions (
  id BIGSERIAL PRIMARY KEY,
  student_id TEXT,
  student_name TEXT,
  teacher_id TEXT,
  teacher_name TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  chat_messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tahfeez_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tahfeez_sessions_read_all"
  ON public.tahfeez_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "tahfeez_sessions_insert_authenticated"
  ON public.tahfeez_sessions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "tahfeez_sessions_manage_authenticated"
  ON public.tahfeez_sessions
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---------- 3) tahfeez_signals (WebRTC signaling relay) ----------
CREATE TABLE IF NOT EXISTS public.tahfeez_signals (
  id BIGSERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tahfeez_signals_room ON public.tahfeez_signals (room_id, created_at);

ALTER TABLE public.tahfeez_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tahfeez_signals_read_all"
  ON public.tahfeez_signals
  FOR SELECT
  USING (true);

CREATE POLICY "tahfeez_signals_insert_authenticated"
  ON public.tahfeez_signals
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "tahfeez_signals_manage_authenticated"
  ON public.tahfeez_signals
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---------- 4) Enable realtime ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tahfeez_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tahfeez_signals;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tahfeez_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tahfeez_sessions;
  END IF;
END $$;
