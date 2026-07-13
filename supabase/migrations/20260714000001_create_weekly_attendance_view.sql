-- Add indexes for efficient weekly/monthly attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_student_date_desc
  ON public.student_daily_attendance(student_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_date_range
  ON public.student_daily_attendance(attendance_date);

-- Function: get weekly attendance for a student in a given year/month
-- Returns JSON array of weeks with attendance data
CREATE OR REPLACE FUNCTION get_student_monthly_attendance(
  p_student_id TEXT,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_result JSONB;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;

  WITH weeks AS (
    SELECT DISTINCT
      date_trunc('week', attendance_date)::DATE + INTERVAL '5 days' AS week_start
      -- Shift to Saturday (PostgreSQL week starts Monday, +5 days = Saturday)
    FROM public.student_daily_attendance
    WHERE student_id = p_student_id
      AND attendance_date BETWEEN v_start_date AND v_end_date
  ),
  attendance_json AS (
    SELECT
      (date_trunc('week', sda.attendance_date)::DATE + INTERVAL '5 days')::DATE AS week_start,
      jsonb_agg(
        jsonb_build_object(
          'date', sda.attendance_date,
          'status', sda.status,
          'day_name', trim(to_char(sda.attendance_date, 'Day'))
        ) ORDER BY sda.attendance_date
      ) AS days,
      COUNT(*) FILTER (WHERE sda.status = 'present') AS present_count,
      COUNT(*) FILTER (WHERE sda.status = 'absent') AS absent_count,
      COUNT(*) FILTER (WHERE sda.status = 'holiday') AS holiday_count
    FROM public.student_daily_attendance sda
    WHERE sda.student_id = p_student_id
      AND sda.attendance_date BETWEEN v_start_date AND v_end_date
    GROUP BY week_start
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'week_start', aj.week_start,
      'week_end', aj.week_start + 6,
      'days', aj.days,
      'present_count', aj.present_count,
      'absent_count', aj.absent_count,
      'holiday_count', aj.holiday_count,
      'working_days', 6
    ) ORDER BY aj.week_start DESC
  ) INTO v_result
  FROM attendance_json aj;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
