-- Bepair / Впаре — important dates in the calendar, and the moon as a personal option.
-- Independent of 0004/0005; run after 0003. Idempotent.
--
-- Important dates are shared by the couple and visible to both at once: they
-- are not an account of a day, so «сначала свой день» does not apply to them.

create table if not exists public.important_dates (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  title       text not null check (length(trim(title)) between 1 and 80),
  date        date not null,
  yearly      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists important_dates_space_idx on public.important_dates (space_id, date);

alter table public.important_dates enable row level security;

drop policy if exists "important_dates readable within space" on public.important_dates;
create policy "important_dates readable within space"
  on public.important_dates for select
  using (space_id = public.bp_my_space());

drop policy if exists "important_dates addable within space" on public.important_dates;
create policy "important_dates addable within space"
  on public.important_dates for insert
  with check (space_id = public.bp_my_space() and created_by = auth.uid());

drop policy if exists "important_dates editable within space" on public.important_dates;
create policy "important_dates editable within space"
  on public.important_dates for update
  using (space_id = public.bp_my_space())
  with check (space_id = public.bp_my_space());

drop policy if exists "important_dates removable within space" on public.important_dates;
create policy "important_dates removable within space"
  on public.important_dates for delete
  using (space_id = public.bp_my_space());

-- The moon phase is a personal display option, off by default.
alter table public.profiles
  add column if not exists show_moon boolean not null default false;
