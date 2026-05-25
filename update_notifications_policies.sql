-- Update system_notifications policies to allow authenticated users to insert in-app notifications
-- Copy and run this script in your Supabase SQL Editor

-- 1. Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.system_notifications;

-- 2. Create new insert policy allowing any authenticated parent or teacher to notify others
CREATE POLICY "Anyone authenticated can insert notifications"
  ON public.system_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Verify RLS remains enabled
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
