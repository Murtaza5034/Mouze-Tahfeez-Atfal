-- ============================================================
-- Remove unused/dead tables to reduce Supabase resource usage
-- (idempotent - safe to re-run)
--
-- 1) chat_messages          - legacy chat system, never used by the app,
--                             was added to supabase_realtime (resource drain)
-- 2) faculty_management     - superseded by teacher_profiles/teacher_attendance
--    faculty_attendance
-- 3) self_jadawal           - typo'd duplicate of self_jadwal (never used)
-- ============================================================

-- ---------- 1) chat_messages ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages;
  END IF;
END $$;

DROP TABLE IF EXISTS public.chat_messages CASCADE;

-- ---------- 2) faculty tables (drop child first due to FK) ----------
DROP TABLE IF EXISTS public.faculty_attendance CASCADE;
DROP TABLE IF EXISTS public.faculty_management CASCADE;

-- ---------- 3) self_jadawal typo table ----------
DROP TABLE IF EXISTS public.self_jadawal CASCADE;
