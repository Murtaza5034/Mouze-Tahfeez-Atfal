begin;

-- Table for teacher public information
create table if not exists public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  full_name text not null,
  email text,
  photo_url text,
  phone_number text,
  whatsapp_number text,
  salary_per_minute numeric default 2.3,
  show_salary_card boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.teacher_profiles enable row level security;

-- Policies
create policy "Anyone can view active teacher profiles" 
on public.teacher_profiles for select 
to authenticated 
using (is_active = true);

create policy "Admins can manage teacher profiles" 
on public.teacher_profiles for all 
to authenticated 
using (public.current_portal_role() = 'admin');

create policy "Teachers can update their own profile" 
on public.teacher_profiles for update 
to authenticated 
using (user_id = auth.uid());

commit;
