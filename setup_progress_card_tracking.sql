-- Run this script in your Supabase SQL Editor to create the parent_report_views table
-- This enables tracking of parent report views and displaying the green/red status light.

CREATE TABLE IF NOT EXISTS public.parent_report_views (
  student_id TEXT PRIMARY KEY,
  viewed BOOLEAN DEFAULT FALSE,
  view_duration_seconds INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable Row Level Security (RLS) to ensure any client can read/write tracking data
ALTER TABLE public.parent_report_views DISABLE ROW LEVEL SECURITY;

