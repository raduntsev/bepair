-- Bepair / Впаре — the couple's photo album, shown by the «Фото» widget.
-- Run after 0010. Idempotent.
--
-- Files live in the `bepair` bucket under <space>/album/, so the existing
-- storage policies already keep them inside the couple. Either partner adds
-- photos; each removes only their own (storage deletes are owner-only too).
-- The widget reads through /api/widget/photo with its read-only key.

create table if not exists public.album_photos (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  path        text not null,
  added_by    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists album_photos_space_idx on public.album_photos (space_id, created_at);

alter table public.album_photos enable row level security;

drop policy if exists "album readable within space" on public.album_photos;
create policy "album readable within space"
  on public.album_photos for select
  using (space_id = public.bp_my_space());

drop policy if exists "album addable within space" on public.album_photos;
create policy "album addable within space"
  on public.album_photos for insert
  with check (space_id = public.bp_my_space() and added_by = auth.uid());

drop policy if exists "album removable by who added" on public.album_photos;
create policy "album removable by who added"
  on public.album_photos for delete
  using (space_id = public.bp_my_space() and added_by = auth.uid());
