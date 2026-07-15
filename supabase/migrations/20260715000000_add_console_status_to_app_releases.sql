-- Migration: Add console_status column to app_releases for Google Play Console flow tracking
alter table if exists public.app_releases
  add column if not exists console_status text not null default 'draft'
  check (console_status in ('draft', 'in_review', 'published'));
