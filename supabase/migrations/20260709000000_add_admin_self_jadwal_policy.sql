-- Allow admin users to view all self_jadwal records for tracking purposes

CREATE POLICY "Admins can view all self_jadwal"
  ON self_jadwal
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_portal_access
      WHERE user_id = auth.uid()
        AND portal_role = 'admin'
    )
  );
