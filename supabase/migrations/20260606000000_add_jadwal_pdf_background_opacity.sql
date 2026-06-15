-- Add background opacity column to jadwal_settings
ALTER TABLE public.jadwal_settings ADD COLUMN IF NOT EXISTS jadwal_pdf_background_opacity REAL DEFAULT 1;
