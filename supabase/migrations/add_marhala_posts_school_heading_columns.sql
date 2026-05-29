-- Run this SQL in your Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/medypnbcsjytbxiwenob/sql/new

ALTER TABLE marhala_posts
  ADD COLUMN IF NOT EXISTS school_heading_ar TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS school_heading_en TEXT DEFAULT '';
