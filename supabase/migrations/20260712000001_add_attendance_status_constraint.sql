ALTER TABLE student_daily_attendance
  DROP CONSTRAINT IF EXISTS student_daily_attendance_status_check,
  ADD CONSTRAINT student_daily_attendance_status_check
    CHECK (status IN ('present', 'absent', 'holiday'));
