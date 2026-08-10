-- Fix: Admins could not see the full list of parents/teachers in the
-- Assignment Hub (and Portal Access audit). `user_portal_access` only exposes
-- the authenticated user's own row (policy "users read own portal access"),
-- so every parent/teacher dropdown under Assignments was empty for the admin.
--
-- Add an admin read-all SELECT policy. Policies are OR'd, so the existing
-- "read own row" policy still protects every other user.

ALTER TABLE public.user_portal_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all portal access" ON public.user_portal_access;
CREATE POLICY "Admins can read all portal access"
ON public.user_portal_access
FOR SELECT
TO authenticated
USING (public.current_portal_role() = 'admin');