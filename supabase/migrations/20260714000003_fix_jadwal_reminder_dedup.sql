-- Fix jadwal reminder timing:
-- 1. Add last_jadwal_reminder_at column for dedup tracking
-- 2. Increase cron frequency to 2 minutes for jadwal-reminder

-- Add column to track last jadwal reminder sent time
alter table if exists public.jadwal_settings
  add column if not exists last_jadwal_reminder_at timestamp with time zone;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Drop the old jadwal-reminder schedule if it exists
    begin
      perform cron.unschedule('jadwal-reminder');
    exception when others then
      raise warning 'Could not unschedule jadwal-reminder (may not exist)';
    end;

    perform cron.schedule(
      'jadwal-reminder',
      '*/2 * * * *',
      'SELECT trigger_jadwal_reminder();'
    );
  end if;
end $$;
