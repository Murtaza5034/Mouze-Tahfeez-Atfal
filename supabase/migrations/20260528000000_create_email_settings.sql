-- Migration: Create email_settings table for Resend email integration
-- Run this in your Supabase SQL Editor to apply

-- 1. Create email_settings table
CREATE TABLE IF NOT EXISTS public.email_settings (
  id SERIAL PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  from_email TEXT DEFAULT 'onboarding@resend.dev',
  subject_template TEXT DEFAULT 'Tahfeez Progress Report for {{child_name}}',
  message_template TEXT DEFAULT 'Salam! Please find attached the weekly Tahfeez progress report for {{child_name}}.',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure there is at least one row in email_settings
INSERT INTO public.email_settings (id, enabled, from_email)
SELECT 1, false, 'onboarding@resend.dev'
WHERE NOT EXISTS (SELECT 1 FROM public.email_settings WHERE id = 1);

-- 2. Set up Row Level Security (RLS)
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- Admins have full access to view, update, or configure email_settings
DROP POLICY IF EXISTS "Admins have full access to email_settings" ON public.email_settings;
CREATE POLICY "Admins have full access to email_settings"
  ON public.email_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_portal_access
      WHERE user_portal_access.user_id = auth.uid()
      AND user_portal_access.portal_role = 'admin'
      AND user_portal_access.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_portal_access
      WHERE user_portal_access.user_id = auth.uid()
      AND user_portal_access.portal_role = 'admin'
      AND user_portal_access.is_active = true
    )
  );

-- 3. Create email_logs table for tracking sent emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id SERIAL PRIMARY KEY,
  student_name TEXT,
  parent_email TEXT,
  subject TEXT,
  status TEXT DEFAULT 'pending', -- 'sent', 'failed'
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to email_logs" ON public.email_logs;
CREATE POLICY "Admins have full access to email_logs"
  ON public.email_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_portal_access
      WHERE user_portal_access.user_id = auth.uid()
      AND user_portal_access.portal_role = 'admin'
      AND user_portal_access.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_portal_access
      WHERE user_portal_access.user_id = auth.uid()
      AND user_portal_access.portal_role = 'admin'
      AND user_portal_access.is_active = true
    )
  );
