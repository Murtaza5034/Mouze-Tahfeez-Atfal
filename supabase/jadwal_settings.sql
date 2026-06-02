begin;

alter table public.report_settings
add column if not exists jadwal_style text default 'table',
add column if not exists jadwal_teacher_style text default 'default',
add column if not exists jadwal_pdf_primary_color text default '#5d4037',
add column if not exists jadwal_pdf_accent_color text default '#d4af37',
add column if not exists jadwal_pdf_background_color text default '#ffffff',
add column if not exists jadwal_pdf_background_url text default '',
add column if not exists jadwal_pdf_font_family text default 'Inter',
add column if not exists jadwal_week_start text default '',
add column if not exists jadwal_week_end text default '';

commit;
