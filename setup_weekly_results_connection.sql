-- Run this in your Supabase SQL Editor to "connect" the weekly results table to parents
-- This enables parents to see their children's progress reports securely.

-- 1. Enable RLS on the weekly_results table (if not already enabled)
ALTER TABLE public.weekly_results ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Parents can view their children's results" ON public.weekly_results;
DROP POLICY IF EXISTS "Anyone read weekly results" ON public.weekly_results;

-- 3. Create the "Proper Connection" policy for Parents
-- This allows a parent to see a result only if the student_id matches one of their children
CREATE POLICY "Parents can view their children's results"
ON public.weekly_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.child_profiles
    WHERE (
      -- Match by UUID
      child_profiles.student_id::text = weekly_results.student_id::text
      OR 
      -- Match by ITS (if stored as ITS in both)
      child_profiles.its = weekly_results.student_id::text
    )
    AND (
      -- Linked by User ID
      child_profiles.parent_user_id = auth.uid()
      OR 
      -- Linked by Email (case-insensitive)
      LOWER(child_profiles.parent_email) = LOWER(auth.jwt() ->> 'email')
    )
  )
);

-- 4. Ensure Admins and Teachers can also see results
DROP POLICY IF EXISTS "Admins and Teachers can view all results" ON public.weekly_results;
CREATE POLICY "Admins and Teachers can view all results"
ON public.weekly_results
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_portal_access
    WHERE user_portal_access.user_id = auth.uid()
    AND user_portal_access.portal_role IN ('admin', 'teacher')
    AND user_portal_access.is_active = true
  )
);

-- 5. Ensure publications are enabled for real-time updates
-- This "links" the table to the real-time engine so parents see the "Save" immediately
-- Note: If this fails, you can enable it in the Supabase UI under Database > Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_results;
