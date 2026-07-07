-- Migration: Add from_name column and update email_settings defaults for Resend
-- The send-email Edge Function references from_name but the column was missing

-- 1. Add from_name column if it doesn't exist
ALTER TABLE public.email_settings
ADD COLUMN IF NOT EXISTS from_name TEXT DEFAULT 'Mauze Tahfeez';

-- 2. Update the default row with Resend sender details
UPDATE public.email_settings
SET
    enabled = true,
    from_email = 'onboarding@resend.dev',
    from_name = 'Mauze Tahfeez',
    updated_at = timezone('utc'::text, now())
WHERE id = 1;

-- 3. If no row exists, insert one
INSERT INTO public.email_settings (id, enabled, from_email, from_name, subject_template, message_template)
SELECT 1, true, 'onboarding@resend.dev', 'Mauze Tahfeez', 'Tahfeez Progress Report for {{child_name}}', 'Salam! Please find attached the weekly Tahfeez progress report for {{child_name}}.'
WHERE NOT EXISTS (SELECT 1 FROM public.email_settings WHERE id = 1);
