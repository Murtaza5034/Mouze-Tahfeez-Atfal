-- Add admin-editable PDF header fields to jadwal_settings
alter table public.jadwal_settings add column if not exists jadwal_pdf_title text default 'MAUZE TAHFEEZ ATFAL';
alter table public.jadwal_settings add column if not exists jadwal_pdf_subtitle text default 'Weekly Quran Jadwal (Timetable)';
alter table public.jadwal_settings add column if not exists jadwal_pdf_academic_portal text default 'ACADEMIC PORTAL';
alter table public.jadwal_settings add column if not exists jadwal_pdf_hifz_program text default 'Hifz Program';
alter table public.jadwal_settings add column if not exists jadwal_pdf_logo_url text default '';

-- Update existing row with current defaults so the row matches the schema
update public.jadwal_settings set
  jadwal_pdf_title = coalesce(jadwal_pdf_title, 'MAUZE TAHFEEZ ATFAL'),
  jadwal_pdf_subtitle = coalesce(jadwal_pdf_subtitle, 'Weekly Quran Jadwal (Timetable)'),
  jadwal_pdf_academic_portal = coalesce(jadwal_pdf_academic_portal, 'ACADEMIC PORTAL'),
  jadwal_pdf_hifz_program = coalesce(jadwal_pdf_hifz_program, 'Hifz Program'),
  jadwal_pdf_logo_url = coalesce(jadwal_pdf_logo_url, '')
where id = 1;
