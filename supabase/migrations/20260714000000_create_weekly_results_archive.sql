-- Create weekly_results_archive table to store historical snapshots of weekly results
-- This preserves filled data even after auto-clear or manual "Clear All Marks"
-- Admin can browse child-by-child, month-by-month in the archive

CREATE TABLE IF NOT EXISTS public.weekly_results_archive (
  id BIGSERIAL PRIMARY KEY,
  student_id TEXT NOT NULL,
  week_date DATE NOT NULL,
  murajazah NUMERIC(5,1),
  juz_hali NUMERIC(5,1),
  takhteet NUMERIC(5,1),
  jadeed NUMERIC(5,1),
  total_score NUMERIC(5,1),
  total_jadeed_pages TEXT,
  wusool_juz TEXT,
  wusool_surah TEXT,
  wusool_page TEXT,
  next_week_juz TEXT,
  next_week_surah TEXT,
  next_week_page TEXT,
  istifadah_juz TEXT,
  istifadah_surah TEXT,
  istifadah_page TEXT,
  matrookah TEXT,
  daeefah TEXT,
  attendance_count INTEGER,
  attendance_note TEXT,
  teacher_edit_count INTEGER DEFAULT 0,
  teacher_locked BOOLEAN DEFAULT false,
  teacher_locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by student and date
CREATE INDEX IF NOT EXISTS idx_weekly_results_archive_student
  ON public.weekly_results_archive (student_id, week_date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_results_archive_date
  ON public.weekly_results_archive (week_date DESC);

-- Trigger function: auto-archive weekly results on save and before clear
CREATE OR REPLACE FUNCTION archive_weekly_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Archive new result saves that have actual score data
    IF NEW.murajazah IS NOT NULL OR NEW.juz_hali IS NOT NULL OR
       NEW.takhteet IS NOT NULL OR NEW.jadeed IS NOT NULL OR
       NEW.total_jadeed_pages IS NOT NULL THEN
      INSERT INTO public.weekly_results_archive (
        student_id, week_date,
        murajazah, juz_hali, takhteet, jadeed, total_score,
        total_jadeed_pages,
        wusool_juz, wusool_surah, wusool_page,
        next_week_juz, next_week_surah, next_week_page,
        istifadah_juz, istifadah_surah, istifadah_page,
        matrookah, daeefah,
        attendance_count, attendance_note,
        teacher_edit_count, teacher_locked, teacher_locked_at,
        created_at, archived_at
      ) VALUES (
        NEW.student_id, NEW.week_date,
        NEW.murajazah, NEW.juz_hali, NEW.takhteet, NEW.jadeed, NEW.total_score,
        NEW.total_jadeed_pages,
        NEW.wusool_juz, NEW.wusool_surah, NEW.wusool_page,
        NEW.next_week_juz, NEW.next_week_surah, NEW.next_week_page,
        NEW.istifadah_juz, NEW.istifadah_surah, NEW.istifadah_page,
        NEW.matrookah, NEW.daeefah,
        NEW.attendance_count, NEW.attendance_note,
        NEW.teacher_edit_count, NEW.teacher_locked, NEW.teacher_locked_at,
        NEW.created_at, NOW()
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if this is a clear operation (scores going from non-null to null)
    IF (OLD.murajazah IS NOT NULL OR OLD.juz_hali IS NOT NULL OR
        OLD.takhteet IS NOT NULL OR OLD.jadeed IS NOT NULL OR
        OLD.total_jadeed_pages IS NOT NULL)
       AND
       (NEW.murajazah IS NULL AND NEW.juz_hali IS NULL AND
        NEW.takhteet IS NULL AND NEW.jadeed IS NULL AND
        NEW.total_jadeed_pages IS NULL) THEN
      -- Archive the OLD values before they get cleared
      INSERT INTO public.weekly_results_archive (
        student_id, week_date,
        murajazah, juz_hali, takhteet, jadeed, total_score,
        total_jadeed_pages,
        wusool_juz, wusool_surah, wusool_page,
        next_week_juz, next_week_surah, next_week_page,
        istifadah_juz, istifadah_surah, istifadah_page,
        matrookah, daeefah,
        attendance_count, attendance_note,
        teacher_edit_count, teacher_locked, teacher_locked_at,
        created_at, archived_at
      ) VALUES (
        OLD.student_id, OLD.week_date,
        OLD.murajazah, OLD.juz_hali, OLD.takhteet, OLD.jadeed, OLD.total_score,
        OLD.total_jadeed_pages,
        OLD.wusool_juz, OLD.wusool_surah, OLD.wusool_page,
        OLD.next_week_juz, OLD.next_week_surah, OLD.next_week_page,
        OLD.istifadah_juz, OLD.istifadah_surah, OLD.istifadah_page,
        OLD.matrookah, OLD.daeefah,
        OLD.attendance_count, OLD.attendance_note,
        OLD.teacher_edit_count, OLD.teacher_locked, OLD.teacher_locked_at,
        OLD.created_at, NOW()
      );

    -- Normal update with score data: archive the new values
    ELSIF NEW.murajazah IS NOT NULL OR NEW.juz_hali IS NOT NULL OR
          NEW.takhteet IS NOT NULL OR NEW.jadeed IS NOT NULL OR
          NEW.total_jadeed_pages IS NOT NULL THEN
      INSERT INTO public.weekly_results_archive (
        student_id, week_date,
        murajazah, juz_hali, takhteet, jadeed, total_score,
        total_jadeed_pages,
        wusool_juz, wusool_surah, wusool_page,
        next_week_juz, next_week_surah, next_week_page,
        istifadah_juz, istifadah_surah, istifadah_page,
        matrookah, daeefah,
        attendance_count, attendance_note,
        teacher_edit_count, teacher_locked, teacher_locked_at,
        created_at, archived_at
      ) VALUES (
        NEW.student_id, NEW.week_date,
        NEW.murajazah, NEW.juz_hali, NEW.takhteet, NEW.jadeed, NEW.total_score,
        NEW.total_jadeed_pages,
        NEW.wusool_juz, NEW.wusool_surah, NEW.wusool_page,
        NEW.next_week_juz, NEW.next_week_surah, NEW.next_week_page,
        NEW.istifadah_juz, NEW.istifadah_surah, NEW.istifadah_page,
        NEW.matrookah, NEW.daeefah,
        NEW.attendance_count, NEW.attendance_note,
        NEW.teacher_edit_count, NEW.teacher_locked, NEW.teacher_locked_at,
        NEW.created_at, NOW()
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Attach trigger to weekly_results
DROP TRIGGER IF EXISTS trg_archive_weekly_result ON public.weekly_results;
CREATE TRIGGER trg_archive_weekly_result
  BEFORE INSERT OR UPDATE ON public.weekly_results
  FOR EACH ROW
  EXECUTE FUNCTION archive_weekly_result();

-- RPC to backfill existing weekly_results data into archive
CREATE OR REPLACE FUNCTION backfill_weekly_results_archive()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  INSERT INTO public.weekly_results_archive (
    student_id, week_date,
    murajazah, juz_hali, takhteet, jadeed, total_score,
    total_jadeed_pages,
    wusool_juz, wusool_surah, wusool_page,
    next_week_juz, next_week_surah, next_week_page,
    istifadah_juz, istifadah_surah, istifadah_page,
    matrookah, daeefah,
    attendance_count, attendance_note,
    teacher_edit_count, teacher_locked, teacher_locked_at,
    created_at, archived_at
  )
  SELECT
    student_id, week_date,
    murajazah, juz_hali, takhteet, jadeed, total_score,
    total_jadeed_pages,
    wusool_juz, wusool_surah, wusool_page,
    next_week_juz, next_week_surah, next_week_page,
    istifadah_juz, istifadah_surah, istifadah_page,
    matrookah, daeefah,
    attendance_count, attendance_note,
    teacher_edit_count, teacher_locked, teacher_locked_at,
    created_at, NOW()
  FROM public.weekly_results
  WHERE (murajazah IS NOT NULL OR juz_hali IS NOT NULL OR
         takhteet IS NOT NULL OR jadeed IS NOT NULL OR
         total_jadeed_pages IS NOT NULL)
    AND (student_id, week_date) NOT IN (
      SELECT student_id, week_date FROM public.weekly_results_archive
      WHERE archived_at IS NOT NULL
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Backfilled ' || v_inserted || ' record(s) into weekly_results_archive.',
    'inserted', v_inserted
  );
END;
$$;

-- Enable RLS on archive table
ALTER TABLE public.weekly_results_archive ENABLE ROW LEVEL SECURITY;

-- Allow admins and teachers full access to archive
DROP POLICY IF EXISTS "Admins and Teachers can access archive" ON public.weekly_results_archive;
CREATE POLICY "Admins and Teachers can access archive"
  ON public.weekly_results_archive
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_portal_access
      WHERE user_portal_access.user_id = auth.uid()
        AND user_portal_access.portal_role IN ('admin', 'teacher')
        AND user_portal_access.is_active = true
    )
  );

-- Allow parents to view their children's archived results
DROP POLICY IF EXISTS "Parents can view children's archived results" ON public.weekly_results_archive;
CREATE POLICY "Parents can view children's archived results"
  ON public.weekly_results_archive
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE (child_profiles.student_id::text = weekly_results_archive.student_id::text
             OR child_profiles.its = weekly_results_archive.student_id)
        AND (child_profiles.parent_user_id = auth.uid()
             OR LOWER(child_profiles.parent_email) = LOWER(auth.jwt() ->> 'email'))
    )
  );
