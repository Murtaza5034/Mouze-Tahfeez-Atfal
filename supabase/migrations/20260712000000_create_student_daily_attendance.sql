-- Create student_daily_attendance table for teacher-marked daily attendance
create table if not exists public.student_daily_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  teacher_id text not null,
  attendance_date date not null default current_date,
  status text not null check (status in ('present', 'absent')),
  created_at timestamptz not null default now()
);

-- One record per student per day
create unique index if not exists idx_student_attendance_unique
  on public.student_daily_attendance(student_id, attendance_date);

-- Index for fast lookups by teacher
create index if not exists idx_student_attendance_teacher_date
  on public.student_daily_attendance(teacher_id, attendance_date);

-- Index for weekly lookups by date range
create index if not exists idx_student_attendance_date
  on public.student_daily_attendance(attendance_date);

alter table public.student_daily_attendance enable row level security;

-- All authenticated users can read student attendance
create policy "Anyone read student attendance"
  on public.student_daily_attendance for select
  to authenticated using (true);

-- All authenticated users can insert/update student attendance
-- (frontend controls which teachers can access which students)
create policy "Authenticated upsert student attendance"
  on public.student_daily_attendance for insert
  to authenticated with check (true);

create policy "Authenticated update student attendance"
  on public.student_daily_attendance for update
  to authenticated using (true);

create policy "Authenticated delete student attendance"
  on public.student_daily_attendance for delete
  to authenticated using (true);
