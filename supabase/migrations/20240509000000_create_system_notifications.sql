-- Create table for storing system notifications
CREATE TABLE IF NOT EXISTS system_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'all',
  target_user TEXT,
  redirect_page TEXT DEFAULT 'Home',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_system_notifications_target_role ON system_notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_system_notifications_target_user ON system_notifications(target_user);
CREATE INDEX IF NOT EXISTS idx_system_notifications_created_at ON system_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_system_notifications_is_read ON system_notifications(is_read);

-- Add RLS policies
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see notifications targeted to their role or specifically to them
CREATE POLICY "Users can view relevant notifications"
  ON system_notifications FOR SELECT
  USING (
    target_role = 'all' OR 
    target_role = auth.jwt()->>'user_role' OR 
    target_user = auth.uid()::text
  );

-- Policy: Admins can insert notifications
CREATE POLICY "Admins can insert notifications"
  ON system_notifications FOR INSERT
  WITH CHECK (
    auth.jwt()->>'user_role' = 'admin'
  );

-- Policy: Admins can update notifications
CREATE POLICY "Admins can update notifications"
  ON system_notifications FOR UPDATE
  USING (
    auth.jwt()->>'user_role' = 'admin'
  );

-- Policy: Users can update their own read status
CREATE POLICY "Users can update own read status"
  ON system_notifications FOR UPDATE
  USING (
    target_user = auth.uid()::text AND is_read = FALSE
  )
  WITH CHECK (
    target_user = auth.uid()::text
  );

-- Policy: Admins can delete notifications
CREATE POLICY "Admins can delete notifications"
  ON system_notifications FOR DELETE
  USING (
    auth.jwt()->>'user_role' = 'admin'
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_system_notifications_updated_at
  BEFORE UPDATE ON system_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_system_notifications_updated_at();
