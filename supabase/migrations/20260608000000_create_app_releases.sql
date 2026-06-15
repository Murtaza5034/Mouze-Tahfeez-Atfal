-- Migration: Create app_releases table for tracking Android app deployments
-- This stores release history from the Google Play Developer API integration

create table if not exists public.app_releases (
  id bigint primary key generated always as identity,
  version_name text not null,
  version_code integer not null,
  track text not null check (track in ('internal', 'alpha', 'beta', 'production')),
  release_notes text default '',
  aab_file_name text not null,
  aab_file_url text,
  aab_file_size bigint default 0,
  status text not null default 'pending' check (status in ('pending', 'uploading', 'deploying', 'live', 'failed')),
  edit_id text,
  bundle_version_code integer,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for quick lookup
create index if not exists idx_app_releases_track on public.app_releases(track);
create index if not exists idx_app_releases_created_at on public.app_releases(created_at desc);

-- RLS
alter table public.app_releases enable row level security;

drop policy if exists "Admins can manage app_releases" on public.app_releases;
create policy "Admins can manage app_releases"
  on public.app_releases for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Anyone can read app_releases" on public.app_releases;
create policy "Anyone can read app_releases"
  on public.app_releases for select
  using (true);

-- Auto-update updated_at
create or replace function update_app_releases_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_releases_updated_at on public.app_releases;
create trigger trg_app_releases_updated_at
  before update on public.app_releases
  for each row
  execute function update_app_releases_updated_at();
