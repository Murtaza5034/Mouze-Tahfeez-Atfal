-- Progress card theme support for Admin > Report Settings
-- Run this once in Supabase SQL Editor before deploying the updated App.jsx.

alter table public.report_settings
  add column if not exists progress_card_background_url text default '',
  add column if not exists progress_card_background_position text default 'center',
  add column if not exists progress_card_overlay_opacity numeric default 0.82;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report_backgrounds',
  'report_backgrounds',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read access is required so report cards and PDF export can load the background image.
drop policy if exists "Public can view report backgrounds" on storage.objects;
create policy "Public can view report backgrounds"
on storage.objects
for select
to public
using (bucket_id = 'report_backgrounds');

-- Authenticated admin users upload from the portal. Tighten this further if your project has admin-only checks.
drop policy if exists "Authenticated users can upload report backgrounds" on storage.objects;
create policy "Authenticated users can upload report backgrounds"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'report_backgrounds');
