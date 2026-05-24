alter table public.report_settings
  add column if not exists auto_lock_enabled boolean default true,
  add column if not exists auto_lock_day text default 'Saturday',
  add column if not exists auto_lock_time text default '00:00',
  add column if not exists auto_unlock_day text default 'Friday',
  add column if not exists auto_unlock_time text default '16:30';
