begin;

create extension if not exists pgcrypto;

create table if not exists public.user_portal_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  full_name text,
  portal_role text not null check (portal_role in ('parents', 'teacher', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_portal_access_updated_at on public.user_portal_access;

create trigger trg_user_portal_access_updated_at
before update on public.user_portal_access
for each row
execute function public.set_updated_at();

create or replace function public.current_portal_role()
returns text
language sql
stable
as $$
  select upa.portal_role
  from public.user_portal_access upa
  where upa.user_id = auth.uid()
    and upa.is_active = true
  limit 1;
$$;

alter table public.user_portal_access enable row level security;

drop policy if exists "users read own portal access" on public.user_portal_access;
drop policy if exists "admins manage portal access" on public.user_portal_access;

create policy "users read own portal access"
on public.user_portal_access
for select
to authenticated
using (user_id = auth.uid());

create table if not exists public.teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  attendance_date date not null default current_date,
  minutes_present integer not null default 0,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.custom_groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  teacher_name text not null,
  created_at timestamptz not null default now()
);

alter table public.teacher_attendance enable row level security;
alter table public.custom_groups enable row level security;

create policy "Admins manage teacher attendance" on public.teacher_attendance for all to authenticated using (public.current_portal_role() = 'admin');
create policy "Anyone read teacher attendance" on public.teacher_attendance for select to authenticated using (true);

create policy "Admins manage custom groups" on public.custom_groups for all to authenticated using (public.current_portal_role() = 'admin');
create policy "Anyone read custom groups" on public.custom_groups for select to authenticated using (true);

create or replace function public.grant_portal_access(
  target_email text,
  target_role text,
  target_name text,
  target_student_id text default null
) returns void
language plpgsql
security definer
as $$
declare
  target_user_id uuid;
begin
  if public.current_portal_role() != 'admin' then
    raise exception 'Unauthorized';
  end if;

  select id into target_user_id from auth.users where email = target_email limit 1;

  if target_user_id is null then
    raise exception 'User not found in Supabase Auth mapping. They must sign up first.';
  end if;

  insert into public.user_portal_access(user_id, email, full_name, portal_role, is_active)
  values(target_user_id, target_email, target_name, target_role, true)
  on conflict (user_id) do update
  set portal_role = excluded.portal_role,
      full_name = excluded.full_name,
      is_active = true;

  -- Link student to profile if provided
  if target_student_id is not null then
    update public.profiles
    set user_id = target_user_id
    where student_id = target_student_id;
  end if;
end;
$$;

commit;

-- Examples:
-- insert into public.user_portal_access (user_id, email, full_name, portal_role)
-- select id, email, 'School Admin', 'admin'
-- from auth.users
-- where email = 'admin@example.com';

-- insert into public.user_portal_access (user_id, email, full_name, portal_role)
-- select id, email, 'Class Teacher', 'teacher'
-- from auth.users
-- where email = 'teacher@example.com';

-- insert into public.user_portal_access (user_id, email, full_name, portal_role)
-- select id, email, 'Student Parent', 'parents'
-- from auth.users
-- where email = 'parent@example.com';

-- update public.user_portal_access
-- set portal_role = 'teacher'
-- where email = 'user@example.com';

-- update public.user_portal_access
-- set is_active = false
-- where email = 'user@example.com';

-- select *
-- from public.user_portal_access
-- order by email;
