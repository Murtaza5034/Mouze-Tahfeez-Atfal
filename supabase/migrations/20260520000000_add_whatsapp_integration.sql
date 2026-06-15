-- 1. Add whatsapp_number column to child_profiles if it doesn't exist
ALTER TABLE public.child_profiles 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 2. Create whatsapp_config table to store integration settings securely
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id SERIAL PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  provider TEXT DEFAULT 'none', -- 'twilio', 'meta', 'custom', 'none'
  api_url TEXT,
  api_token TEXT,
  account_sid TEXT,
  from_number TEXT,
  message_template TEXT DEFAULT 'Salam! The weekly Tahfeez result for {{child_name}} is now live. View it here: https://mouze-tahfeez-atfal.vercel.app/',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure there is at least one row in whatsapp_config
INSERT INTO public.whatsapp_config (id, enabled, provider)
SELECT 1, false, 'none'
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_config WHERE id = 1);

-- 3. Setup Row Level Security (RLS) for whatsapp_config
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Admins have full access to view, update, or configure whatsapp_config
DROP POLICY IF EXISTS "Admins have full access to whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Admins have full access to whatsapp_config"
  ON public.whatsapp_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_portal_access
      WHERE user_portal_access.user_id = auth.uid()
      AND user_portal_access.portal_role = 'admin'
      AND user_portal_access.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_portal_access
      WHERE user_portal_access.user_id = auth.uid()
      AND user_portal_access.portal_role = 'admin'
      AND user_portal_access.is_active = true
    )
  );
