-- Ensure email_settings row exists with the correct Resend test domain
INSERT INTO public.email_settings (id, enabled, from_email, subject_template, message_template)
SELECT 1, true, 'onboarding@resend.dev', 'Tahfeez Progress Report for {{child_name}}', 'Salam! Please find attached the weekly Tahfeez progress report for {{child_name}}.'
WHERE NOT EXISTS (SELECT 1 FROM public.email_settings WHERE id = 1);

-- If it already exists, update it to use the Resend test domain and enable it
UPDATE public.email_settings
SET from_email = 'onboarding@resend.dev',
    enabled = true,
    updated_at = timezone('utc'::text, now())
WHERE id = 1;
