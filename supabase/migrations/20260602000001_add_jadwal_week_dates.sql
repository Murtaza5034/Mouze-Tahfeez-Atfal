begin;

alter table public.report_settings
add column if not exists jadwal_week_start text default '',
add column if not exists jadwal_week_end text default '';

commit;
