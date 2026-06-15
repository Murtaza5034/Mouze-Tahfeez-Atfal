-- Add surah columns to weekly_results for detailed tracking in Juz 26-30 range
-- For high juz levels (26-30), each juz contains multiple surahs, so we store the exact surah.

ALTER TABLE public.weekly_results
ADD COLUMN IF NOT EXISTS wusool_surah TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_week_surah TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS istifadah_surah TEXT DEFAULT NULL;
