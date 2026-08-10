-- Make current_portal_role() bulletproof: read the role WITHOUT RLS applying
-- (SECURITY DEFINER), so the admin policy below reliably sees 'admin'.
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

-- Drop old policy by name first (idempotent) so re-running never fails.
DROP POLICY IF EXISTS allow_admin_read_all_portal_access ON public.user_portal_access;
DROP POLICY IF EXISTS admin_read_all_portal_access ON public.user_portal_access;

-- Admins (current_portal_role() = 'admin') may SELECT every row.
CREATE POLICY allow_admin_read_all_portal_access
ON public.user_portal_access
FOR SELECT
TO authenticated
USING (public.current_portal_role() = 'admin');

-- Keep non-admin users limited to their own row only.
DROP POLICY IF EXISTS authenticated_read_own_portal_access ON public.user_portal_access;
CREATE POLICY authenticated_read_own_portal_access
ON public.user_portal_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());