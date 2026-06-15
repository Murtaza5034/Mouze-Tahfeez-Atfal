-- Create marhala_settings table for global visibility toggle
create table if not exists marhala_settings (
  id integer primary key default 1,
  posts_hidden boolean default false,
  updated_at timestamptz default now()
);

-- Insert default row
insert into marhala_settings (id, posts_hidden) values (1, false)
on conflict (id) do nothing;

-- Enable RLS
alter table marhala_settings enable row level security;

-- All authenticated users can read
create policy "Anyone authenticated can view marhala_settings"
  on marhala_settings for select
  to authenticated
  using (true);

-- Only admin can update
create policy "Admin can insert marhala_settings"
  on marhala_settings for insert
  to authenticated
  with check (true);

create policy "Admin can update marhala_settings"
  on marhala_settings for update
  to authenticated
  using (true);
