-- Add parent_leave_enabled column to jadwal_settings
-- This lets admin toggle the Parent Leave Portal on/off from the Schedule page

alter table if exists public.jadwal_settings
  add column if not exists parent_leave_enabled boolean not null default true;

-- Update the existing row (id=1) to have the default value
update public.jadwal_settings
  set parent_leave_enabled = true
  where id = 1 and parent_leave_enabled is null;
