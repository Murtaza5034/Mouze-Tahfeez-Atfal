-- Add gender column to teacher_profiles table for Muhafiz/MuhafeZah tag display
alter table if exists public.teacher_profiles
  add column if not exists gender text not null default 'male';

-- Add a check constraint to ensure valid values
alter table if exists public.teacher_profiles
  add constraint teacher_profiles_gender_check
  check (gender in ('male', 'female'));
