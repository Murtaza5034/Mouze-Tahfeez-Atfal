-- Enable realtime for jadwal_settings (parent_leave_enabled toggle) and
-- page_visibility so the parent portal reflects admin visibility changes
-- (like the Parent Leave Portal on/off toggle) immediately without a reload.
alter publication supabase_realtime add table public.jadwal_settings;
alter publication supabase_realtime add table public.page_visibility;
