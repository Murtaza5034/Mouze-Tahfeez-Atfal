-- ===============================================================
-- FIX 1: Add missing columns to marhala_posts table
-- These columns are used by the Marhala Posts form but were
-- never added to the database table
-- ===============================================================

-- Add background_url for user-uploaded certificate backgrounds
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS background_url TEXT DEFAULT '';

-- Add school heading columns for Arabic/English school names
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_ar TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_en TEXT DEFAULT '';

-- Add age column
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS age TEXT DEFAULT '';

-- Add arabic_name column
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS arabic_name TEXT DEFAULT '';

-- ===============================================================
-- FIX 2: Add date_of_birth column to child_profiles
-- ===============================================================
ALTER TABLE public.child_profiles 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- ===============================================================
-- FIX 3: Create marhala_post_photos storage bucket
-- ===============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marhala_post_photos',
  'marhala_post_photos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage policies
create policy if not exists "Anyone can view marhala post photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'marhala_post_photos');

create policy if not exists "Admin can upload marhala post photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'marhala_post_photos');

create policy if not exists "Admin can update marhala post photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'marhala_post_photos');

create policy if not exists "Admin can delete marhala post photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'marhala_post_photos');
