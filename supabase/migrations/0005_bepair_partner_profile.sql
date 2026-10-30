-- Bepair / Впаре — partner profile: when they are usually here.
-- Run after 0004. Idempotent.
--
-- The profile answers «когда партнёру удобно», not «сколько у него баллов»:
-- when they last opened the app and when their reminders come. Read through a
-- function so it does not depend on how the profiles table policies are set up.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Called by the app on open and when it comes back to the foreground.
-- Written at most every five minutes, so it is a rhythm, not a live tracker.
create or replace function public.bp_touch()
returns void
language sql security definer set search_path = public
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '5 minutes')
$$;

grant execute on function public.bp_touch() to authenticated;

create or replace function public.bp_partner_rhythm()
returns table (
  last_seen_at       timestamptz,
  timezone           text,
  remind_morning     boolean,
  remind_morning_at  time,
  remind_evening     boolean,
  remind_evening_at  time
)
language sql stable security definer set search_path = public
as $$
  select p.last_seen_at, p.timezone,
         p.remind_morning, p.remind_morning_at, p.remind_evening, p.remind_evening_at
  from public.profiles p
  where p.id = public.bp_partner_id()
$$;

grant execute on function public.bp_partner_rhythm() to authenticated;
