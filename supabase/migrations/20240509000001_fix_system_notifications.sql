-- Fix system_notifications table - add missing is_read column if it doesn't exist
DO $$
BEGIN
    -- Check if the table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_notifications' AND table_schema = 'public') THEN
        -- Check if is_read column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_notifications' AND column_name = 'is_read' AND table_schema = 'public') THEN
            ALTER TABLE system_notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
            RAISE NOTICE 'Added is_read column to system_notifications table';
        ELSE
            RAISE NOTICE 'is_read column already exists in system_notifications table';
        END IF;
        
        -- Create indexes if they don't exist
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'system_notifications' AND indexname = 'idx_system_notifications_target_role') THEN
            CREATE INDEX IF NOT EXISTS idx_system_notifications_target_role ON system_notifications(target_role);
            RAISE NOTICE 'Created target_role index';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'system_notifications' AND indexname = 'idx_system_notifications_target_user') THEN
            CREATE INDEX IF NOT EXISTS idx_system_notifications_target_user ON system_notifications(target_user);
            RAISE NOTICE 'Created target_user index';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'system_notifications' AND indexname = 'idx_system_notifications_created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_system_notifications_created_at ON system_notifications(created_at);
            RAISE NOTICE 'Created created_at index';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'system_notifications' AND indexname = 'idx_system_notifications_is_read') THEN
            CREATE INDEX IF NOT EXISTS idx_system_notifications_is_read ON system_notifications(is_read);
            RAISE NOTICE 'Created is_read index';
        END IF;
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE system_notifications (
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
        
        -- Create all indexes
        CREATE INDEX idx_system_notifications_target_role ON system_notifications(target_role);
        CREATE INDEX idx_system_notifications_target_user ON system_notifications(target_user);
        CREATE INDEX idx_system_notifications_created_at ON system_notifications(created_at);
        CREATE INDEX idx_system_notifications_is_read ON system_notifications(is_read);
        
        RAISE NOTICE 'Created system_notifications table with all columns';
    END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view relevant notifications" ON system_notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON system_notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON system_notifications;
DROP POLICY IF EXISTS "Users can update own read status" ON system_notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON system_notifications;

-- Recreate policies
CREATE POLICY "Users can view relevant notifications"
  ON system_notifications FOR SELECT
  USING (
    target_role = 'all' OR 
    target_role = auth.jwt()->>'user_role' OR 
    target_user = auth.uid()::text
  );

CREATE POLICY "Admins can insert notifications"
  ON system_notifications FOR INSERT
  WITH CHECK (
    auth.jwt()->>'user_role' = 'admin'
  );

CREATE POLICY "Admins can update notifications"
  ON system_notifications FOR UPDATE
  USING (
    auth.jwt()->>'user_role' = 'admin'
  );

CREATE POLICY "Users can update own read status"
  ON system_notifications FOR UPDATE
  USING (
    target_user = auth.uid()::text AND is_read = FALSE
  )
  WITH CHECK (
    target_user = auth.uid()::text
  );

CREATE POLICY "Admins can delete notifications"
  ON system_notifications FOR DELETE
  USING (
    auth.jwt()->>'user_role' = 'admin'
  );

-- Create or replace the update trigger function
CREATE OR REPLACE FUNCTION update_system_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_system_notifications_updated_at ON system_notifications;
CREATE TRIGGER update_system_notifications_updated_at
  BEFORE UPDATE ON system_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_system_notifications_updated_at();
