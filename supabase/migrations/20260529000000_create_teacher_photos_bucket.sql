-- Migration: 20260529000000_create_teacher_photos_bucket.sql
-- Create a public storage bucket for teacher profile photos with appropriate access policies

-- Create the storage bucket (public so profile photos load everywhere)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teacher_photos',
  'teacher_photos',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies to prevent duplicates on re-run
DROP POLICY IF EXISTS "Anyone can view teacher photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload teacher photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete teacher photos" ON storage.objects;

-- Storage Policy: Anyone can view (download) teacher photos
CREATE POLICY "Anyone can view teacher photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'teacher_photos');

-- Storage Policy: Authenticated users (teachers/admins) can upload teacher photos
CREATE POLICY "Authenticated users can upload teacher photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'teacher_photos');

-- Storage Policy: Authenticated users can delete teacher photos
CREATE POLICY "Authenticated users can delete teacher photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'teacher_photos');
