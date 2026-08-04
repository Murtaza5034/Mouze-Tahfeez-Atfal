-- Add gender to child_profiles so the Uzur (excused) attendance button
-- can be shown only for girl (female) students.
alter table public.child_profiles
  add column if not exists gender text not null default 'male';

-- Allow the new 'uzur' (excused, عذر) status used for girl students only.
alter table public.student_daily_attendance
  drop constraint if exists student_daily_attendance_status_check,
  add constraint student_daily_attendance_status_check
    check (status in ('present', 'absent', 'holiday', 'uzur'));
