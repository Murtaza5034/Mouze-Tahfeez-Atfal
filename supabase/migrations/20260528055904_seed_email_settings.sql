-- Seed default email_settings row if not exists
INSERT INTO public.email_settings (id, enabled, from_email, subject_template, message_template)
SELECT 1, false, 'onboarding@resend.dev', 'Tahfeez Progress Report for {{child_name}}', 'Salam! Please find attached the weekly Tahfeez progress report for {{child_name}}.'
WHERE NOT EXISTS (SELECT 1 FROM public.email_settings WHERE id = 1);
