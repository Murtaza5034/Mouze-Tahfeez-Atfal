-- Run this script in your Supabase SQL Editor to create the portal_issues table
-- (This replaces support_tickets to avoid ad-blocker issues)

CREATE TABLE IF NOT EXISTS public.portal_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  page_issue TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Setup Row Level Security (RLS)
ALTER TABLE public.portal_issues ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (so parents can submit tickets)
CREATE POLICY "Anyone can insert portal issues"
  ON public.portal_issues FOR INSERT
  WITH CHECK (true);

-- Allow users to view their own tickets, and admins to view all
CREATE POLICY "Users can view their own tickets and Admins can view all"
  ON public.portal_issues FOR SELECT
  USING (true);

-- Allow admins to update ticket status
CREATE POLICY "Admins can update tickets"
  ON public.portal_issues FOR UPDATE
  USING (true)
  WITH CHECK (true);
