-- Add total_jadeed_unit column to weekly_results to persist the Safha/Satar dropdown
ALTER TABLE public.weekly_results
  ADD COLUMN IF NOT EXISTS total_jadeed_unit TEXT DEFAULT 'صفه';

-- Also add to archive table for consistency
ALTER TABLE public.weekly_results_archive
  ADD COLUMN IF NOT EXISTS total_jadeed_unit TEXT DEFAULT 'صفه';

-- Update archive trigger function to include the new column
CREATE OR REPLACE FUNCTION public.archive_weekly_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.murajazah IS NOT NULL OR NEW.juz_hali IS NOT NULL OR
       NEW.takhteet IS NOT NULL OR NEW.jadeed IS NOT NULL OR
       NEW.total_jadeed_pages IS NOT NULL THEN
      INSERT INTO public.weekly_results_archive (
        student_id, week_date,
        murajazah, juz_hali, takhteet, jadeed, total_score,
        total_jadeed_pages, total_jadeed_unit,
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
        NEW.total_jadeed_pages, NEW.total_jadeed_unit,
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
    IF (OLD.murajazah IS NOT NULL OR OLD.juz_hali IS NOT NULL OR
        OLD.takhteet IS NOT NULL OR OLD.jadeed IS NOT NULL OR
        OLD.total_jadeed_pages IS NOT NULL)
       AND
       (NEW.murajazah IS NULL AND NEW.juz_hali IS NULL AND
        NEW.takhteet IS NULL AND NEW.jadeed IS NULL AND
        NEW.total_jadeed_pages IS NULL) THEN
      INSERT INTO public.weekly_results_archive (
        student_id, week_date,
        murajazah, juz_hali, takhteet, jadeed, total_score,
        total_jadeed_pages, total_jadeed_unit,
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
        OLD.total_jadeed_pages, OLD.total_jadeed_unit,
        OLD.wusool_juz, OLD.wusool_surah, OLD.wusool_page,
        OLD.next_week_juz, OLD.next_week_surah, OLD.next_week_page,
        OLD.istifadah_juz, OLD.istifadah_surah, OLD.istifadah_page,
        OLD.matrookah, OLD.daeefah,
        OLD.attendance_count, OLD.attendance_note,
        OLD.teacher_edit_count, OLD.teacher_locked, OLD.teacher_locked_at,
        OLD.created_at, NOW()
      );

    ELSIF NEW.murajazah IS NOT NULL OR NEW.juz_hali IS NOT NULL OR
          NEW.takhteet IS NOT NULL OR NEW.jadeed IS NOT NULL OR
          NEW.total_jadeed_pages IS NOT NULL THEN
      INSERT INTO public.weekly_results_archive (
        student_id, week_date,
        murajazah, juz_hali, takhteet, jadeed, total_score,
        total_jadeed_pages, total_jadeed_unit,
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
        NEW.total_jadeed_pages, NEW.total_jadeed_unit,
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
