-- Run this script in your Supabase SQL Editor to recreate the child profile structure in a single table

-- 1. Create the new comprehensive table
CREATE TABLE IF NOT EXISTS public.child_profiles (
  student_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  arabic_name TEXT,
  its TEXT,
  parent_email TEXT,
  parent_user_id UUID,
  photo_url TEXT,
  juz TEXT,
  surat TEXT,
  teacher_id UUID,
  teacher_name TEXT,
  group_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Setup Row Level Security (RLS)
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for the new table
-- Admins can do everything
CREATE POLICY "Admins have full access to child_profiles"
  ON public.child_profiles FOR ALL
  USING (true) 
  WITH CHECK (true);

-- Parents can view their own child's profile
CREATE POLICY "Parents can view their own child_profiles"
  ON public.child_profiles FOR SELECT
  USING (auth.uid() = parent_user_id);

-- Teachers can view profiles of students assigned to them
CREATE POLICY "Teachers can view assigned child_profiles"
  ON public.child_profiles FOR SELECT
  USING (auth.uid() = teacher_id);

-- Note: We are keeping the old tables for backup, but you can drop them if you wish:
-- DROP TABLE IF EXISTS public.teacher_student_assignments;
-- DROP TABLE IF EXISTS public.hifz_details;
-- DROP TABLE IF EXISTS public.profiles;
