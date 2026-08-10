-- ============================================================================
-- PERFORMANCE & SAFETY MIGRATION
-- Fixes Supabase resource exhaustion caused by:
--   1. Full-table scans on hot query columns (missing indexes)
--   2. The parent fallback downloading the ENTIRE child_profiles table
--      via get_all_child_profiles() (SECURITY DEFINER, unfiltered)
--
-- All statements are idempotent (IF NOT EXISTS / guards) and safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. INDEXES on every hot query column used by the portal
--    (each guarded so the migration never fails on an older/newer schema)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- events: ordered by event_date / created_at everywhere
  IF to_regclass('public.events') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC)';
  END IF;

  -- schedule: filtered by student_id, ordered by task_time
  IF to_regclass('public.schedule') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_schedule_student_task ON public.schedule(student_id, task_time)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_schedule_task_time ON public.schedule(task_time)';
  END IF;

  -- weekly_results: ordered by week_date (unique student/week already exists)
  IF to_regclass('public.weekly_results') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_weekly_results_week_date ON public.weekly_results(week_date DESC)';
  END IF;

  -- weekly_results_archive: ordered by week_date
  IF to_regclass('public.weekly_results_archive') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_weekly_results_archive_week_date ON public.weekly_results_archive(week_date DESC)';
  END IF;

  -- teacher_attendance: ordered by attendance_date
  IF to_regclass('public.teacher_attendance') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON public.teacher_attendance(attendance_date DESC)';
  END IF;

  -- portal_issues: ordered by created_at
  IF to_regclass('public.portal_issues') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portal_issues_created ON public.portal_issues(created_at DESC)';
  END IF;

  -- student_leaves: filtered by student_id, ordered by created_at
  IF to_regclass('public.student_leaves') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_student_leaves_student ON public.student_leaves(student_id, created_at DESC)';
  END IF;

  -- event_leaves: ordered by created_at
  IF to_regclass('public.event_leaves') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_event_leaves_created ON public.event_leaves(created_at DESC)';
  END IF;

  -- tahfeez_sessions: ordered by created_at (online tahfeez history)
  IF to_regclass('public.tahfeez_sessions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tahfeez_sessions_created ON public.tahfeez_sessions(created_at DESC)';
  END IF;

  -- child_profiles: filtered by parent / teacher links on every portal load
  IF to_regclass('public.child_profiles') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_child_profiles_parent_user ON public.child_profiles(parent_user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_child_profiles_parent_email ON public.child_profiles(lower(parent_email))';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_child_profiles_teacher ON public.child_profiles(teacher_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_child_profiles_badal ON public.child_profiles(badal_teacher_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_child_profiles_original ON public.child_profiles(original_teacher_id)';
  END IF;

  -- teacher_profiles: matched by user_id / full_name
  IF to_regclass('public.teacher_profiles') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_teacher_profiles_user ON public.teacher_profiles(user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_teacher_profiles_name ON public.teacher_profiles(full_name)';
  END IF;

  -- user_portal_access: ordered by created_at
  IF to_regclass('public.user_portal_access') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_portal_access_created ON public.user_portal_access(created_at DESC)';
  END IF;

  -- teacher_leaves: filtered by teacher_id, ordered by created_at
  IF to_regclass('public.teacher_leaves') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_teacher_leaves_teacher ON public.teacher_leaves(teacher_id, created_at DESC)';
  END IF;

  -- teacher_leave_badals: filtered by original_teacher_id / active
  IF to_regclass('public.teacher_leave_badals') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_teacher_leave_badals_original ON public.teacher_leave_badals(original_teacher_id, active)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_teacher_leave_badals_active ON public.teacher_leave_badals(active, to_date)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. GUARANTEE COLUMNS USED BY RLS POLICIES EXIST
--    PostgREST returns HTTP 500 (not 403) when a policy references a missing
--    column (e.g. badal_teacher_id / original_teacher_id on child_profiles).
--    These adds are idempotent, so this migration is safe on any schema.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.child_profiles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.child_profiles
      ADD COLUMN IF NOT EXISTS badal_teacher_id TEXT,
      ADD COLUMN IF NOT EXISTS original_teacher_id TEXT,
      ADD COLUMN IF NOT EXISTS teacher_id UUID,
      ADD COLUMN IF NOT EXISTS parent_user_id UUID,
      ADD COLUMN IF NOT EXISTS parent_email TEXT';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. SCOPED PARENT RPC (replaces the full-table fallback)
--    Returns ONLY the child profiles linked to the requesting parent —
--    server-side filter, no RLS bypass that exposes every student to parents.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_child_profiles(p_user_id text, p_email text DEFAULT NULL)
RETURNS SETOF public.child_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.*
  FROM public.child_profiles cp
  WHERE (
          p_user_id IS NOT NULL
          AND p_user_id ~ '^[0-9a-fA-F-]{36}$'
          AND cp.parent_user_id = p_user_id::uuid
        )
     OR (
          p_email IS NOT NULL
          AND cp.parent_email IS NOT NULL
          AND lower(btrim(cp.parent_email)) = lower(btrim(p_email))
        )
  ORDER BY cp.full_name ASC;
$$;

-- Do not let unauthenticated callers hit the RPC; only signed-in users may use it.
REVOKE ALL ON FUNCTION public.get_my_child_profiles(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_child_profiles(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. REFRESH PLANNER STATISTICS so Postgres uses the new indexes immediately
--    (guarded so a table created only via the SQL editor can never abort this)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'events', 'schedule', 'weekly_results', 'weekly_results_archive',
    'teacher_attendance', 'portal_issues', 'student_leaves', 'event_leaves',
    'tahfeez_sessions', 'child_profiles', 'teacher_profiles',
    'user_portal_access', 'parent_report_views', 'miqaat_calendar',
    'teacher_leaves', 'teacher_leave_badals'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE 'ANALYZE public.' || quote_ident(t);
    END IF;
  END LOOP;
END $$;
