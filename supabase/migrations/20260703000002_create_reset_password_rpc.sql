-- Migration: Add RPC for password reset (used by Login page Forgot Password
-- and Admin Portal Staff Profile password reset).
-- SECURITY DEFINER lets this function modify auth.users when called by anon role.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION reset_user_password(
  target_email TEXT,
  new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_uid UUID;
  user_exists BOOLEAN;
  result JSONB;
BEGIN
  -- Trim inputs
  target_email := TRIM(target_email);
  new_password := TRIM(new_password);

  -- Validate inputs
  IF target_email = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Email is required');
  END IF;

  IF LENGTH(new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Password must be at least 6 characters');
  END IF;

  -- Check if user exists with this email
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = target_email) INTO user_exists;
  
  IF NOT user_exists THEN
    RETURN jsonb_build_object('success', false, 'message', 'No account found with this email address');
  END IF;
  
  -- Get the user ID
  SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
  
  -- Update password using crypt hashing (same method Supabase uses)
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = NOW(),
    -- Ensure the user can login (in case email was not confirmed)
    email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = target_uid;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Password has been reset successfully. The user can now login with the new password.',
    'user_id', target_uid::TEXT
  );
END;
$$;
