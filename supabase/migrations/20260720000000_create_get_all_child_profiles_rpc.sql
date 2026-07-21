-- 1. Fix RLS policy on child_profiles to also allow original_teacher_id
--    Without this, original teachers cannot see students who have a badal teacher assigned.
DROP POLICY IF EXISTS "Teachers can view assigned child_profiles" ON public.child_profiles;

CREATE POLICY "Teachers can view assigned child_profiles"
  ON public.child_profiles FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR
    auth.uid()::text = badal_teacher_id
    OR
    auth.uid()::text = original_teacher_id
  );

-- 2. Create a SECURITY DEFINER function that returns all child_profiles,
--    bypassing RLS so teacher users can see all students for the Badal page's
--    universal student selector dropdown.
CREATE OR REPLACE FUNCTION get_all_child_profiles()
RETURNS SETOF child_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM child_profiles ORDER BY full_name ASC;
$$;
