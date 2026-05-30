-- Add background_url column to marhala_posts for custom certificate backgrounds
alter table marhala_posts
  add column if not exists background_url text default '';
