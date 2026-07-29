ALTER TABLE public.whatsapp_config
ADD COLUMN IF NOT EXISTS auto_send_on_publish BOOLEAN DEFAULT false;
