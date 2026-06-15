begin;

-- Create a dedicated table for faculty attendance management
create table if not exists public.faculty_management (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  photo_url text,
  salary_per_minute numeric default 2.3,
  show_salary_card boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.faculty_management enable row level security;

-- Policies
create policy "Anyone can view active faculty" 
on public.faculty_management for select 
to authenticated 
using (is_active = true);

create policy "Admins can manage faculty" 
on public.faculty_management for all 
to authenticated 
using (public.current_portal_role() = 'admin');

-- Create a table for faculty attendance records
create table if not exists public.faculty_attendance (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid references public.faculty_management(id) on delete cascade,
  faculty_name text not null,
  attendance_date date not null,
  minutes_present integer default 0,
  status text check (status in ('Present', 'Absent', 'Pending')),
  note text,
  created_at timestamptz default now()
);

alter table public.faculty_attendance enable row level security;

-- Policies for attendance
create policy "Anyone can view faculty attendance" 
on public.faculty_attendance for select 
to authenticated;

create policy "Admins can manage faculty attendance" 
on public.faculty_attendance for all 
to authenticated 
using (public.current_portal_role() = 'admin');

-- Index for better performance
create index if not exists idx_faculty_attendance_date on public.faculty_attendance(attendance_date);
create index if not exists idx_faculty_attendance_name on public.faculty_attendance(faculty_name);

commit;
