-- Change total_jadeed_pages column from integer to text
-- This allows teachers to enter values like "2 سطر" (2 lines) instead of only integers

ALTER TABLE public.weekly_results
  ALTER COLUMN total_jadeed_pages TYPE text USING total_jadeed_pages::text;
