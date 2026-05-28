-- Add age column to marhala_posts for editable age display on post cards
alter table marhala_posts
  add column if not exists age text default '';
