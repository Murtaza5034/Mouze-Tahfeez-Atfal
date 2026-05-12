-- Add visibility controls to report_settings
ALTER TABLE public.report_settings 
ADD COLUMN IF NOT EXISTS reports_live BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS live_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Ensure there is at least one row in report_settings
INSERT INTO public.report_settings (id, main_heading, sub_heading, wusool_heading, next_week_heading, istifadah_heading, reports_live)
SELECT 1, 'Rawdat Tahfeez al Atfal', 'TAHFEEZ REPORT 1447H', 'وصول الى الاْن', 'Next Week Target', 'Target Till Istifadah', true
WHERE NOT EXISTS (SELECT 1 FROM public.report_settings WHERE id = 1);

-- RLS Policies for report_settings
ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;

-- 1. Admins have full control
DROP POLICY IF EXISTS "Admins have full control over report_settings" ON public.report_settings;
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

-- 2. Everyone else (Parents/Teachers) can read
DROP POLICY IF EXISTS "Anyone authenticated can read report_settings" ON public.report_settings;
CREATE POLICY "Anyone authenticated can read report_settings"
ON public.report_settings
FOR SELECT
TO authenticated
USING (true);
