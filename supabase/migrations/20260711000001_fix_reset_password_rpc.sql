-- Fix reset_user_password to not depend on pgcrypto schema location.
-- pgcrypto may be in public (created by portal_access.sql without schema)
-- or in extensions. Using search_path resolves gen_salt/crypt either way.

CREATE OR REPLACE FUNCTION reset_user_password(
  target_email TEXT,
  new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  target_uid UUID;
  user_exists BOOLEAN;
BEGIN
  target_email := TRIM(target_email);
  new_password := TRIM(new_password);

  IF target_email = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Email is required');
  END IF;

  IF LENGTH(new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Password must be at least 6 characters');
  END IF;

  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = target_email) INTO user_exists;

  IF NOT user_exists THEN
    RETURN jsonb_build_object('success', false, 'message', 'No account found with this email address');
  END IF;

  SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = NOW(),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = target_uid;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Password has been reset successfully. The user can now login with the new password.',
    'user_id', target_uid::TEXT
  );
END;
$$;
