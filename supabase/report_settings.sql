begin;

alter table public.report_settings
add column if not exists reports_live boolean default true,
add column if not exists allow_teacher_progress_entry boolean default true,
add column if not exists live_at timestamptz,
add column if not exists main_heading text default 'Rawdat Tahfeez al Atfal',
add column if not exists sub_heading text default 'TAHFEEZ REPORT 1447H',
add column if not exists weekly_score_heading text default 'Total Weekly Score',
add column if not exists jumla_heading text default 'Jumla',
add column if not exists murajazah_heading text default 'Murajah',
add column if not exists juz_hali_heading text default 'Juz Hali',
add column if not exists takhteet_heading text default 'Takhteet',
add column if not exists jadeed_heading text default 'Jadeed',
add column if not exists jadeed_safahat_heading text default 'Jadeed Safahat',
add column if not exists attendance_heading text default 'Attendance',
add column if not exists matrookah_heading text default 'Matrookah',
add column if not exists daeefah_heading text default 'Zaeefah',
add column if not exists wusool_heading text default 'Wusool',
add column if not exists wusool_juz_heading text default 'Wusool Juz',
add column if not exists wusool_page_heading text default 'Wusool Page',
add column if not exists next_week_heading text default 'Next Week Target',
add column if not exists next_week_juz_heading text default 'Next Week Juz',
add column if not exists next_week_page_heading text default 'Next Week Page',
add column if not exists istifadah_heading text default 'Target Till',
add column if not exists istifadah_juz_heading text default 'Its Juz',
add column if not exists istifadah_page_heading text default 'Its Page';

commit;
