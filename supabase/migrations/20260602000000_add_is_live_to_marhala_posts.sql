-- Add is_live and live_at columns to marhala_posts for per-post live control
-- When is_live = true, the post is visible on teacher/parent home pages for 24 hours

alter table marhala_posts
add column if not exists is_live boolean default false,
add column if not exists live_at timestamptz default now();
