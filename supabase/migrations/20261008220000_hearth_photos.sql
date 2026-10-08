-- Your own photos on the Hearth (CORE-041, CORE-046): wallpaper photos and
-- the pictures in Photo frame widgets.
--
-- Private to you: each photo lives at "<your user id>/<file>" in the hearth
-- bucket, and only you can see, add or remove files under your own id.
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hearth', 'hearth', false,
  8388608,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do nothing;

create function public.owns_hearth_photo(object_name text)
returns boolean
language sql
stable
as $$
  select split_part(object_name, '/', 1) = (select auth.uid())::text;
$$;

create policy "hearth photos seen by their owner" on storage.objects
  for select to authenticated
  using (bucket_id = 'hearth' and public.owns_hearth_photo(name));

create policy "hearth photos added by their owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hearth' and public.owns_hearth_photo(name));

create policy "hearth photos removed by their owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'hearth' and public.owns_hearth_photo(name));
