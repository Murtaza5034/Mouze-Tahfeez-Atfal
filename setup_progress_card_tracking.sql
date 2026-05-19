-- Run this script in your Supabase SQL Editor to create the parent_report_views table
-- This enables tracking of parent report views and displaying the green/red status light.

CREATE TABLE IF NOT EXISTS public.parent_report_views (
  student_id TEXT PRIMARY KEY,
  viewed BOOLEAN DEFAULT FALSE,
  view_duration_seconds INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.parent_report_views ENABLE ROW LEVEL SECURITY;

-- Create policies to allow selecting, inserting, and updating views
DROP POLICY IF EXISTS "Allow select for everyone" ON public.parent_report_views;
DROP POLICY IF EXISTS "Allow insert/update for everyone" ON public.parent_report_views;

CREATE POLICY "Allow select for everyone"
  ON public.parent_report_views FOR SELECT
  USING (true);

CREATE POLICY "Allow insert/update for everyone"
  ON public.parent_report_views FOR ALL
  USING (true)
  WITH CHECK (true);
