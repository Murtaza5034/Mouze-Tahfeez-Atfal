-- Fix 403 on report_settings admin writes (upsert at src/App.jsx).
-- The read-only policy exists on the live DB, but the admin ALL/UPDATE
-- policy was only defined in repo-root .sql files and never deployed.

ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read settings (idempotent)
DROP POLICY IF EXISTS "Anyone authenticated can read report_settings" ON public.report_settings;
CREATE POLICY "Anyone authenticated can read report_settings"
ON public.report_settings
FOR SELECT
TO authenticated
USING (true);

-- Admins have full read/write/update/delete (idempotent)
DROP POLICY IF EXISTS "Admins have control over report_settings" ON public.report_settings;
CREATE POLICY "Admins have control over report_settings"
ON public.report_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_portal_access
    WHERE user_portal_access.user_id = auth.uid()
      AND user_portal_access.portal_role = 'admin'
      AND user_portal_access.is_active = true
  )
);