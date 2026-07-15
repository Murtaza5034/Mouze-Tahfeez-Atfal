-- Fix RLS policy on child_profiles to include badal_teacher_id
-- Without this, badal teachers cannot see children assigned to them as badal
-- because the existing policy only checks teacher_id = auth.uid()

DROP POLICY IF EXISTS "Teachers can view assigned child_profiles" ON public.child_profiles;

CREATE POLICY "Teachers can view assigned child_profiles"
  ON public.child_profiles FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR
    auth.uid()::text = badal_teacher_id
  );
