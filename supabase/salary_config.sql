begin;

-- Add salary configuration to portal access
alter table public.user_portal_access 
add column if not exists salary_per_minute numeric default 2.3,
add column if not exists show_salary_card boolean default false;

-- Enhance teacher attendance to track by email/id for calculation
alter table public.teacher_attendance 
add column if not exists teacher_email text;

-- Add safety index
create index if not exists idx_teacher_attendance_email on public.teacher_attendance(teacher_email);
create index if not exists idx_teacher_attendance_date on public.teacher_attendance(attendance_date);

commit;
