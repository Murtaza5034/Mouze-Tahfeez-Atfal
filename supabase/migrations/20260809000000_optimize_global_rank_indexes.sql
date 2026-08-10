-- ============================================================================
-- CPU / IO-WAIT FIX: ELIMINATE FULL-TABLE SCANS ON HOT QUERIES
--
-- Root cause: the get-global-rank Edge Function pulled the ENTIRE
--   weekly_results table into the server, then sorted/deduplicated it in JS.
--   As that table grows, every rank request = a full sequential disk scan
--   (exactly the "CPU idle waiting on disk / IO wait" Supabase is reporting).
--
-- This migration:
--   1. Adds a covering index that lets Postgres answer
--      "latest result per student" with a single ordered index scan
--      (no seq scan, no sort).
--   2. Creates get_latest_weekly_results() — returns ONLY the newest result
--      row per student via DISTINCT ON over that index.
--   3. Creates get_global_ranks() — computes the exact same leaderboard as
--      the old edge function, but 100% in SQL.
--
-- All statements are idempotent and safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. COVERING INDEX for "latest result per student"
--    Backs DISTINCT ON(student_id) ORDER BY student_id, week_date DESC.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_weekly_results_student_week_date
  ON public.weekly_results (student_id, week_date DESC);

-- Index for the leaderboard ordered by score (used by get_global_ranks).
CREATE INDEX IF NOT EXISTS idx_weekly_results_total_score
  ON public.weekly_results (student_id, week_date DESC)
  INCLUDE (total_score, jadeed, total_jadeed_pages, attendance_count,
           murajazah, juz_hali, takhteet);

-- ---------------------------------------------------------------------------
-- 2. LATEST-PER-STUDENT RPC (single ordered index scan, no seq scan)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_latest_weekly_results()
RETURNS SETOF public.weekly_results
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (wr.student_id) wr.*
  FROM public.weekly_results wr
  ORDER BY wr.student_id, wr.week_date DESC NULLS LAST;
$$;

-- ---------------------------------------------------------------------------
-- 3. FULL LEADERBOARD IN SQL
--    Replicates the exact tie-breaking of the old get-global-rank edge
--    function (total_score desc, then jadeed, then page count, then
--    attendance) restricted to students present in child_profiles.
--    Returns JSON: { "ranks": { <student_id>: rank }, "total": n }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_global_ranks_any()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH latest AS (
    SELECT DISTINCT ON (wr.student_id) wr.*
    FROM public.weekly_results wr
    ORDER BY wr.student_id, wr.week_date DESC NULLS LAST
  ),
  valid AS (
    SELECT l.*
    FROM latest l
    JOIN public.child_profiles cp
      ON lower(btrim(cp.student_id::text)) = lower(btrim(l.student_id::text))
  ),
  keyed AS (
    SELECT
      student_id,
      COALESCE(total_score, 0) AS total_score,
      COALESCE(jadeed, 0) AS jadeed,
      -- Mirror the old JS: strip every non-digit/dot from the TEXT column.
      COALESCE(NULLIF(regexp_replace(COALESCE(total_jadeed_pages::text, ''),
        '[^0-9.]', '', 'g'), '')::numeric, 0) AS jadeed_pages,
      COALESCE(attendance_count, 0) AS attendance_count
    FROM valid
  ),
  ranked_all AS (
    SELECT *,
      RANK() OVER (
        ORDER BY total_score DESC,
                 jadeed DESC,
                 jadeed_pages DESC,
                 attendance_count DESC
      ) AS rnk
    FROM keyed
  ),
  agg AS (
    SELECT
      jsonb_object_agg(
        lower(btrim(student_id::text)), rnk
      ) AS ranks,
      count(*)::int AS total
    FROM ranked_all
  )
  SELECT jsonb_build_object('ranks', COALESCE(ranks, '{}'::jsonb), 'total', COALESCE(total,0))
  INTO result
  FROM agg;

  RETURN result;
END;
$$;

-- Revoke anon/public, grant authenticated only (same posture as the other RPCs).
REVOKE ALL ON FUNCTION public.get_latest_weekly_results() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_weekly_results() TO authenticated;

REVOKE ALL ON FUNCTION public.get_global_ranks_any() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_global_ranks_any() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. REFRESH STATISTICS so the planner picks the new indexes immediately.
-- ---------------------------------------------------------------------------
ANALYZE public.weekly_results;

-- ---------------------------------------------------------------------------
-- 5. SUPPLEMENTARY INDEXES for the weekly reminder / attendance functions
--    which filter these columns (jadwal-reminder every 15 min, parent portals).
--    Guarded so the migration never fails on a schema missing the table.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.jadawal') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jadawal_student_id ON public.jadawal(student_id)';
  END IF;
  IF to_regclass('public.child_profiles') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_child_profiles_student_id ON public.child_profiles(student_id)';
    EXECUTE 'ANALYZE public.child_profiles';
  END IF;
END $$;