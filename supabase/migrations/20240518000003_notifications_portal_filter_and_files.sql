-- Migration: 20240518000003_notifications_portal_filter_and_files.sql
-- Add file_url column to system_notifications
ALTER TABLE public.system_notifications ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Drop existing SELECT policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view relevant notifications" ON public.system_notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.system_notifications;

-- Policy: Users can view notifications that match their role, are sent to all, or are addressed to them directly
CREATE POLICY "Users can view relevant notifications"
  ON public.system_notifications FOR SELECT
  USING (
    target_role = 'all' OR 
    target_role = public.current_portal_role() OR 
    target_user = auth.uid()::text OR
    target_user = (auth.jwt() ->> 'email')
  );

-- Policy: Admins can view all notifications in their history
CREATE POLICY "Admins can view all notifications"
  ON public.system_notifications FOR SELECT
  USING (
    public.current_portal_role() = 'admin'
  );

-- Insert public storage bucket for notification files (images, PDFs, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('notification_files', 'notification_files', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist to prevent duplicates
DROP POLICY IF EXISTS "Anyone can view notification files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload notification files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete notification files" ON storage.objects;

-- Storage Policy: Anyone can select (view/download) files from the notification_files bucket
CREATE POLICY "Anyone can view notification files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'notification_files');

-- Storage Policy: Only Admins can upload files to the notification_files bucket
CREATE POLICY "Admins can upload notification files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'notification_files' AND
    public.current_portal_role() = 'admin'
  );

-- Storage Policy: Only Admins can delete files from the notification_files bucket
CREATE POLICY "Admins can delete notification files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'notification_files' AND
    public.current_portal_role() = 'admin'
  );
