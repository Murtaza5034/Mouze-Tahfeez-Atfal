-- ============================================================================
-- Fix: In the Supabase backend (dashboard/Table Editor) the admin could only
-- see `child_profiles` data while every other table appeared empty.
--
-- Root cause: RLS admin detection was too fragile.
--   * `child_profiles` has an admin policy with `USING (true)`  -> always shows
--   * Every other table gates admin reads behind one of:
--       1) `EXISTS (SELECT 1 FROM user_portal_access WHERE user_id = auth.uid()
--                  AND portal_role = 'admin' AND is_active = true)`
--       2) `public.current_portal_role() = 'admin'`
--       3) JWT claim checks: `auth.jwt() ->> 'user_role' = 'admin'`
--       4) own-row checks:   `auth.uid()::text = user_id`
--   The dashboard session usually does not satisfy these, so the tables
--   render as empty in the backend.
--
-- This migration is PURELY ADDITIVE. RLS policies are OR'd together, so:
--   * Parents/teachers keep exactly the same scoped visibility as before.
--   * Admins gain read access to every row in every table.
--   * No data is deleted, no table is altered, no app code changes.
--
-- Safe to re-run (all statements are idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Bulletproof admin detection
--    `current_portal_role()` reads user_portal_access WITHOUT RLS applying so
--    the admin policy below reliably sees 'admin'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_portal_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT portal_role
  FROM public.user_portal_access
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 2) is_portal_admin(): the single source of truth for "is this user an admin"
--    Mirrors the app's own getAssignedRoles() (src/App.jsx) which reads:
--      user_metadata.portal_roles | app_metadata.portal_roles
--      user_metadata.portal_role  | user_metadata.role
--      app_metadata.portal_role   | app_metadata.role
--    PLUS the user_portal_access table (portal_role = 'admin', active)
--    PLUS the legacy `user_role` JWT claim used by system_notifications.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_portal_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- (a) active admin row in user_portal_access
    EXISTS (
      SELECT 1 FROM public.user_portal_access
      WHERE user_id = auth.uid()
        AND portal_role = 'admin'
        AND is_active = true
    )
    OR
    -- (b) legacy JWT claim used by the system_notifications policies
    lower(COALESCE(auth.jwt() ->> 'user_role', '')) = 'admin'
    OR
    -- (c) metadata claims (mirrors getAssignedRoles in src/App.jsx, which
    --     lowercases every role before comparing)
    lower(COALESCE(auth.jwt() -> 'user_metadata' ->> 'portal_role', '')) = 'admin'
    OR lower(COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '')) = 'admin'
    OR lower(COALESCE(auth.jwt() -> 'app_metadata' ->> 'portal_role', '')) = 'admin'
    OR lower(COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    -- portal_roles may be a JSON array ("[\"admin\",\"teacher\"]") or a
    -- comma-separated string ("admin,teacher"); match 'admin' only as a whole
    -- token so 'subadmin'/'administrator' can never false-positive.
    OR lower(COALESCE(auth.jwt() -> 'user_metadata' ->> 'portal_roles', '')) ~ '(^|[,\[\" ])admin($|[,\]\" ])'
    OR lower(COALESCE(auth.jwt() -> 'app_metadata' ->> 'portal_roles', '')) ~ '(^|[,\[\" ])admin($|[,\]\" ])'
$$;

-- ----------------------------------------------------------------------------
-- 3) Add "Admins can read all" SELECT policies to every table whose reads
--    were gated behind user_portal_access / JWT / own-row checks.
--    Tables that already have `USING (true)` read access (child_profiles,
--    events, schedule, teacher_profiles-active, marhala_posts, etc.) are left
--    untouched.
-- ----------------------------------------------------------------------------

-- weekly_results (admin/teacher gated via user_portal_access)
DROP POLICY IF EXISTS "Admins can read all weekly_results" ON public.weekly_results;
CREATE POLICY "Admins can read all weekly_results"
  ON public.weekly_results FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- weekly_results_archive (admin/teacher gated via user_portal_access)
DROP POLICY IF EXISTS "Admins can read all weekly_results_archive" ON public.weekly_results_archive;
CREATE POLICY "Admins can read all weekly_results_archive"
  ON public.weekly_results_archive FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- system_notifications (gated via auth.jwt()->>'user_role' / target matching)
DROP POLICY IF EXISTS "Admins can read all system_notifications" ON public.system_notifications;
CREATE POLICY "Admins can read all system_notifications"
  ON public.system_notifications FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- whatsapp_config (admin gated via user_portal_access)
DROP POLICY IF EXISTS "Admins can read all whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Admins can read all whatsapp_config"
  ON public.whatsapp_config FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- email_settings (admin gated via user_portal_access)
DROP POLICY IF EXISTS "Admins can read all email_settings" ON public.email_settings;
CREATE POLICY "Admins can read all email_settings"
  ON public.email_settings FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- email_logs (admin gated via user_portal_access)
DROP POLICY IF EXISTS "Admins can read all email_logs" ON public.email_logs;
CREATE POLICY "Admins can read all email_logs"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- teacher_unlock_logs (admin gated via user_portal_access subquery)
DROP POLICY IF EXISTS "Admins can read all teacher_unlock_logs" ON public.teacher_unlock_logs;
CREATE POLICY "Admins can read all teacher_unlock_logs"
  ON public.teacher_unlock_logs FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- user_portal_access (admin gated via current_portal_role(); extend to metadata too)
DROP POLICY IF EXISTS "Admins can read all portal access" ON public.user_portal_access;
CREATE POLICY "Admins can read all portal access"
  ON public.user_portal_access FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- self_jadwal (admin gated via user_portal_access)
DROP POLICY IF EXISTS "Admins can read all self_jadwal" ON public.self_jadwal;
CREATE POLICY "Admins can read all self_jadwal"
  ON public.self_jadwal FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- self_jadwal_notifications (own-row gated)
DROP POLICY IF EXISTS "Admins can read all self_jadwal_notifications" ON public.self_jadwal_notifications;
CREATE POLICY "Admins can read all self_jadwal_notifications"
  ON public.self_jadwal_notifications FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- user_fcm_tokens (own-row gated)
DROP POLICY IF EXISTS "Admins can read all user_fcm_tokens" ON public.user_fcm_tokens;
CREATE POLICY "Admins can read all user_fcm_tokens"
  ON public.user_fcm_tokens FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- elearning_tracking (own-row gated)
DROP POLICY IF EXISTS "Admins can read all elearning_tracking" ON public.elearning_tracking;
CREATE POLICY "Admins can read all elearning_tracking"
  ON public.elearning_tracking FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- attendance_reminder_state (service_role-only; let the admin inspect it too)
DROP POLICY IF EXISTS "Admins can read all attendance_reminder_state" ON public.attendance_reminder_state;
CREATE POLICY "Admins can read all attendance_reminder_state"
  ON public.attendance_reminder_state FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- teacher_profiles: the existing "Anyone can view active teacher profiles"
-- only exposes is_active = true rows. Let admins see inactive ones as well.
DROP POLICY IF EXISTS "Admins can read all teacher_profiles" ON public.teacher_profiles;
CREATE POLICY "Admins can read all teacher_profiles"
  ON public.teacher_profiles FOR SELECT
  TO authenticated
  USING (public.is_portal_admin());

-- ----------------------------------------------------------------------------
-- 4) DEPLOYMENT PREREQUISITE — make sure YOUR dashboard account is admin.
--
-- This migration only helps if `is_portal_admin()` recognizes your session.
-- Run in the SQL Editor:
--
--     SELECT public.is_portal_admin();
--
--   * If it returns `true`  -> done, every table now shows all rows.
--   * If it returns `false` -> grant yourself admin access first:
--
--     INSERT INTO public.user_portal_access (user_id, email, full_name, portal_role, is_active)
--     SELECT id, email, 'School Admin', 'admin', true
--     FROM auth.users
--     WHERE email = 'YOUR_DASHBOARD_LOGIN_EMAIL'
--     ON CONFLICT (user_id) DO UPDATE
--       SET portal_role = 'admin', is_active = true;
--
--     (If your roles live in JWT metadata instead — e.g. user_metadata.role =
--     'admin' — the migration already picks that up with no extra step.)
-- ----------------------------------------------------------------------------
