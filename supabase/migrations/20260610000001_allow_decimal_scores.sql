-- Change murajazah, juz_hali, takhteet, jadeed from integer to numeric
-- to allow decimal point values for more precise scoring.
-- Must drop dependent trigger and generated column first, then recreate.

DROP TRIGGER IF EXISTS trg_update_ranks ON weekly_results;

ALTER TABLE weekly_results
  DROP COLUMN IF EXISTS total_score;

ALTER TABLE weekly_results
  ALTER COLUMN murajazah TYPE numeric(5,1) USING murajazah::numeric(5,1),
  ALTER COLUMN juz_hali TYPE numeric(5,1) USING juz_hali::numeric(5,1),
  ALTER COLUMN takhteet TYPE numeric(5,1) USING takhteet::numeric(5,1),
  ALTER COLUMN jadeed TYPE numeric(5,1) USING jadeed::numeric(5,1);

ALTER TABLE weekly_results
  ADD COLUMN total_score numeric(5,1) GENERATED ALWAYS AS (
    COALESCE(murajazah, 0) + COALESCE(juz_hali, 0) + COALESCE(takhteet, 0) + COALESCE(jadeed, 0)
  ) STORED;

CREATE TRIGGER trg_update_ranks
  AFTER INSERT OR UPDATE OF murajazah, juz_hali, takhteet, jadeed
  ON public.weekly_results
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_ranks();
