-- Fix RLS policy on child_profiles to include badal_teacher_id and original_teacher_id
-- Without this, badal teachers cannot see children assigned to them as badal,
-- and original teachers cannot see children who have been assigned a badal teacher

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
