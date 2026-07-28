ALTER TABLE public.whatsapp_config
ADD COLUMN IF NOT EXISTS openwa_session_id TEXT;
