begin;

create table if not exists public.jadwal_settings (
  id integer primary key default 1,
  jadwal_style text default 'table',
  jadwal_teacher_style text default 'default',
  jadwal_pdf_primary_color text default '#5d4037',
  jadwal_pdf_accent_color text default '#d4af37',
  jadwal_pdf_background_color text default '#ffffff',
  jadwal_pdf_background_url text default '',
  jadwal_pdf_font_family text default 'Inter',
  jadwal_type text default 'weekly',
  jadwal_week_start text default '',
  jadwal_week_end text default '',
  jadwal_pdf_title text default 'MAUZE TAHFEEZ ATFAL',
  jadwal_pdf_subtitle text default 'Weekly Quran Jadwal (Timetable)',
  jadwal_pdf_academic_portal text default 'ACADEMIC PORTAL',
  jadwal_pdf_hifz_program text default 'Hifz Program',
  jadwal_pdf_logo_url text default '',
  jadwal_pdf_background_opacity real default 1
);

insert into public.jadwal_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.jadwal_settings enable row level security;

drop policy if exists "Admins can manage jadwal_settings" on public.jadwal_settings;
create policy "Admins can manage jadwal_settings"
  on public.jadwal_settings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Anyone can read jadwal_settings" on public.jadwal_settings;
create policy "Anyone can read jadwal_settings"
  on public.jadwal_settings for select
  using (true);

commit;
