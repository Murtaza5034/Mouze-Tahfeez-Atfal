-- Create table for storing FCM tokens
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id ON user_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_role ON user_fcm_tokens(user_role);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_fcm_token ON user_fcm_tokens(fcm_token);

-- Add RLS policies
ALTER TABLE user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tokens
CREATE POLICY "Users can view own FCM tokens"
  ON user_fcm_tokens FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Users can only insert their own tokens
CREATE POLICY "Users can insert own FCM tokens"
  ON user_fcm_tokens FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can only update their own tokens
CREATE POLICY "Users can update own FCM tokens"
  ON user_fcm_tokens FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Policy: Users can only delete their own tokens
CREATE POLICY "Users can delete own FCM tokens"
  ON user_fcm_tokens FOR DELETE
  USING (auth.uid()::text = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_fcm_tokens_updated_at
  BEFORE UPDATE ON user_fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
