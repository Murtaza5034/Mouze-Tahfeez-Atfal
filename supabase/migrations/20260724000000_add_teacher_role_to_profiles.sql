/
-0741/85*96-+
/*
+-*/+
*dd teacher_role column to teacher_profiles for Masool, Musaid, Muhaffiz designation
alter table if exists public.teacher_profiles
  add column if not exists teacher_role text not null default 'muhaffiz';

-- Drop constraint if exists so we can normalize data
alter table if exists public.teacher_profiles
  drop constraint if exists teacher_profiles_teacher_role_check;

-- Normalize existing values to lowercase
update public.teacher_profiles
  set teacher_role = lower(teacher_role)
  where teacher_role is not null;

-- Add a check constraint to ensure valid values
alter table if exists public.teacher_profiles
  add constraint teacher_profiles_teacher_role_check
  check (teacher_role in ('muhaffiz', 'masool', 'musaid'));
0*+
*+
*+
*+
*+
*+*
//
+-*/