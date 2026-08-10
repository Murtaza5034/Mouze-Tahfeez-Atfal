-- ============================================================================
-- REMAINING EXECUTION-FLAVOR / ORDERING INDEXES for the admin portal load
--
-- The admin/teacher portal (App.jsx portal loader) reads nearly every table
-- on each load, ordered by a display column. An index on those order-by
-- columns lets Postgres serve them as ordered index scans instead of a full
-- seq-scan + file-sort on every portal open — the queries the Supabase
-- "expensive queries" panel keeps flagging.
--
-- All idempotent / guarded.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.child_profiles') IS NOT NULL THEN
    -- Admin portal orders full list by full_name; Badal joins by student_id.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_child_profiles_full_name ON public.child_profiles(full_name ASC)';
    EXECUTE 'ANALYZE public.child_profiles';
  END IF;

  IF to_regclass('public.teacher_profiles') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_teacher_profiles_full_name ON public.teacher_profiles(full_name ASC)';
    EXECUTE 'ANALYZE public.teacher_profiles';
  END IF;

  IF to_regclass('public.custom_groups') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_custom_groups_group_name ON public.custom_groups(group_name ASC)';
  END IF;

  IF to_regclass('public.user_portal_access') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_portal_access_full_name ON public.user_portal_access(full_name ASC)';
  END IF;

  IF to_regclass('public.weekly_results') IS NOT NULL THEN
    -- Admin portal pulls the most recent 10k results in week order.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_weekly_results_week_date_desc ON public.weekly_results(week_date DESC)';
    EXECUTE 'ANALYZE public.weekly_results';
  END IF;
END $$;