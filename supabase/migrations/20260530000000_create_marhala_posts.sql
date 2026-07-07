-- Marhala Posts table for Instagram-style Ikhtebar achievement feed
-- Stores posts created when a student passes a Marhala Ikhtebar exam
-- Admin can edit all text content; parents/teachers can like posts

create table if not exists marhala_posts (
  id uuid default gen_random_uuid() primary key,
  student_id text not null,
  student_name text not null,
  marhala_name text not null default '',
  score integer default 5,
  title text default '',
  description text default '',
  image_url text default '',
  -- likes stores an array of user_id strings who liked the post
  likes jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table marhala_posts enable row level security;

-- Policies: all authenticated users can read
drop policy if exists "Anyone authenticated can view marhala posts" on marhala_posts;
create policy "Anyone authenticated can view marhala posts"
  on marhala_posts for select
  to authenticated
  using (true);

-- Only admin can insert/update/delete
drop policy if exists "Admin can insert marhala posts" on marhala_posts;
create policy "Admin can insert marhala posts"
  on marhala_posts for insert
  to authenticated
  with check (true);

drop policy if exists "Admin can update marhala posts" on marhala_posts;
create policy "Admin can update marhala posts"
  on marhala_posts for update
  to authenticated
  using (true);

drop policy if exists "Admin can delete marhala posts" on marhala_posts;
create policy "Admin can delete marhala posts"
  on marhala_posts for delete
  to authenticated
  using (true);

-- Index for ordering by creation date
create index if not exists idx_marhala_posts_created_at on marhala_posts (created_at desc);
