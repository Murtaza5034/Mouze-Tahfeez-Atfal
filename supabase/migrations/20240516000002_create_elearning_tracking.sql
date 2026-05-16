-- Migration to create elearning tracking table
-- This table will persist the days a teacher clicks the eLearning link

begin;

create table if not exists public.elearning_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracked_date date not null,
  created_at timestamptz not null default now(),
  unique(user_id, tracked_date)
);

-- Enable RLS
alter table public.elearning_tracking enable row level security;

-- Policies
drop policy if exists "Users can manage their own elearning tracking" on public.elearning_tracking;
create policy "Users can manage their own elearning tracking"
on public.elearning_tracking
for all
to authenticated
using (user_id = auth.uid());

commit;
