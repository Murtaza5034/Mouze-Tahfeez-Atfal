-- Create storage bucket for Marhala post photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marhala_post_photos',
  'marhala_post_photos',
  true,
  5242880, -- 5 MB limit
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Allow authenticated users to view/upload photos
create policy "Anyone can view marhala post photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'marhala_post_photos');

create policy "Admin can upload marhala post photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'marhala_post_photos');

create policy "Admin can update marhala post photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'marhala_post_photos');

create policy "Admin can delete marhala post photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'marhala_post_photos');
