-- =============================================================
-- RUN THIS IN SUPABASE SQL EDITOR (https://supabase.com)
-- Adds ALL missing columns to marhala_posts table
-- =============================================================

-- Add background_url for custom certificate backgrounds
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS background_url TEXT DEFAULT '';

-- Add school heading columns for Arabic/English school names
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_ar TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_en TEXT DEFAULT '';

-- Add age column
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS age TEXT DEFAULT '';

-- Add arabic_name column
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS arabic_name TEXT DEFAULT '';

-- Add heading column (same as title, used as fallback)
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS heading TEXT DEFAULT '';

-- Add is_live for per-post live control
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;

-- Add live_at timestamp for 24-hour auto-expiry
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS live_at TIMESTAMPTZ DEFAULT now();

-- Add background_opacity for certificate background visibility control
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS background_opacity REAL DEFAULT 0.3;

-- Add heading_url for custom heading image upload
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS heading_url TEXT DEFAULT '';
-- Add heading_scale for heading image size control (percentage)
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS heading_scale NUMERIC DEFAULT 100;

-- Create marhala_post_photos storage bucket for photo uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marhala_post_photos',
  'marhala_post_photos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (use DO block to handle "already exists" gracefully)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view marhala post photos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Anyone can view marhala post photos"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'marhala_post_photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can upload marhala post photos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Admin can upload marhala post photos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'marhala_post_photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update marhala post photos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Admin can update marhala post photos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'marhala_post_photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete marhala post photos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Admin can delete marhala post photos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'marhala_post_photos');
  END IF;
END $$;

-- Create marhala_settings table if not exists
CREATE TABLE IF NOT EXISTS marhala_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  posts_hidden BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO marhala_settings (id, posts_hidden) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE marhala_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone authenticated can view marhala_settings' AND tablename = 'marhala_settings') THEN
    CREATE POLICY "Anyone authenticated can view marhala_settings"
      ON marhala_settings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert marhala_settings' AND tablename = 'marhala_settings') THEN
    CREATE POLICY "Admin can insert marhala_settings"
      ON marhala_settings FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update marhala_settings' AND tablename = 'marhala_settings') THEN
    CREATE POLICY "Admin can update marhala_settings"
      ON marhala_settings FOR UPDATE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Add date_of_birth to child_profiles
ALTER TABLE public.child_profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE;
