-- RPC to look up a user's UUID by email from auth.users.
-- SECURITY DEFINER so admins can find existing auth users.
CREATE OR REPLACE FUNCTION get_user_id_by_email(target_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;
  RETURN v_user_id;
END;
$$;
