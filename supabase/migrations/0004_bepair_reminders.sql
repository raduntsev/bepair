-- Bepair / Впаре — morning and evening reminders, and «просмотрено».
-- Run after 0003. Idempotent: safe to run again.
--
-- Morning: look at yesterday's day of your partner — only if they marked it,
--          you are allowed to see it, and you have not opened it yet.
-- Evening: mark your own day — only if today is still unmarked.
--
-- Reminders are written into the in-app feed by pg_cron every five minutes.
-- System push needs one more hop: the same job calls /api/push/cron on the app
-- through pg_net. Without pg_net the reminders still appear in the feed.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Personal reminder settings
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists remind_morning       boolean not null default true,
  add column if not exists remind_morning_at    time    not null default '09:00',
  add column if not exists remind_evening       boolean not null default true,
  add column if not exists remind_evening_at    time    not null default '21:30',
  add column if not exists reminded_morning_on  date,
  add column if not exists reminded_evening_on  date;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. «Просмотрено» — you opened your partner's day
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.day_views (
  viewer_id   uuid not null references public.profiles (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  entry_date  date not null,
  viewed_at   timestamptz not null default now(),
  primary key (viewer_id, owner_id, entry_date)
);

alter table public.day_views enable row level security;

drop policy if exists "day_views readable by viewer" on public.day_views;
create policy "day_views readable by viewer"
  on public.day_views for select
  using (viewer_id = auth.uid());
-- No insert policy: a view is recorded only through the function below, and
-- only for an entry that exists in your own space.

create or replace function public.bp_mark_day_viewed(d date)
returns void
language sql security definer set search_path = public
as $$
  insert into public.day_views (viewer_id, owner_id, entry_date)
  select auth.uid(), e.user_id, e.entry_date
  from public.day_entries e
  where e.space_id = public.bp_my_space()
    and e.user_id <> auth.uid()
    and e.entry_date = d
  on conflict do nothing
$$;

grant execute on function public.bp_mark_day_viewed(date) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Two new notification kinds
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'ping', 'day', 'task_new', 'task_done', 'task_seen', 'letter',
  'service', 'paired_proposal', 'paired_answer', 'joined',
  'remind_morning', 'remind_evening'));

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Queue the reminders that are due
-- ═════════════════════════════════════════════════════════════════════════════
-- Each reminder has a three-hour window after its time and fires at most once
-- a day. The window never crosses midnight, so an evening reminder never
-- arrives the next morning asking about the wrong day.

create or replace function public.bp_queue_reminders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r         record;
  sent      integer := 0;
  local_ts  timestamp;
  local_d   date;
  local_t   time;
  other     uuid;
  y         date;
begin
  for r in
    select p.id, p.space_id, p.timezone,
           p.remind_morning, p.remind_morning_at, p.reminded_morning_on,
           p.remind_evening, p.remind_evening_at, p.reminded_evening_on
    from public.profiles p
    where p.space_id is not null and (p.remind_morning or p.remind_evening)
  loop
    local_ts := now() at time zone coalesce(r.timezone, 'UTC');
    local_d  := local_ts::date;
    local_t  := local_ts::time;

    -- Evening: your own day is still unmarked.
    if r.remind_evening
       and r.reminded_evening_on is distinct from local_d
       and local_t >= r.remind_evening_at
       and local_t - r.remind_evening_at < interval '3 hours'
       and not public.bp_has_marked(local_d, r.id)
    then
      perform public.bp_notify(r.id, null, r.space_id, 'remind_evening', null,
        jsonb_build_object('date', local_d));
      update public.profiles set reminded_evening_on = local_d where id = r.id;
      sent := sent + 1;
    end if;

    -- Morning: yesterday's day of your partner is marked, open to you, not yet seen.
    other := public.bp_other_member(r.space_id, r.id);
    y := local_d - 1;
    if r.remind_morning
       and other is not null
       and r.reminded_morning_on is distinct from local_d
       and local_t >= r.remind_morning_at
       and local_t - r.remind_morning_at < interval '3 hours'
       and public.bp_has_marked(y, other)
       and (not public.bp_reveal_first(r.space_id) or public.bp_has_marked(y, r.id))
       and not exists (
         select 1 from public.day_views v
         where v.viewer_id = r.id and v.owner_id = other and v.entry_date = y)
    then
      perform public.bp_notify(r.id, other, r.space_id, 'remind_morning', null,
        jsonb_build_object('date', y));
      update public.profiles set reminded_morning_on = local_d where id = r.id;
      sent := sent + 1;
    end if;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.bp_queue_reminders() from public, anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Server config for the push hop — invisible to the app's users
-- ═════════════════════════════════════════════════════════════════════════════
-- Fill once in SQL Editor (the same secret goes to Vercel as CRON_SECRET):
--   insert into public.bp_server_config (key, value) values
--     ('app_url', 'https://vpare.vercel.app'),
--     ('cron_secret', '<длинная случайная строка>')
--   on conflict (key) do update set value = excluded.value;

create table if not exists public.bp_server_config (
  key    text primary key,
  value  text not null
);

alter table public.bp_server_config enable row level security;
-- No policies at all: neither anon nor signed-in users can read it.
revoke all on public.bp_server_config from anon, authenticated;

create or replace function public.bp_reminders_tick()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  app_url text;
  secret  text;
begin
  perform public.bp_queue_reminders();

  select value into app_url from public.bp_server_config where key = 'app_url';
  select value into secret  from public.bp_server_config where key = 'cron_secret';
  if app_url is null or secret is null then
    return;
  end if;

  begin
    perform net.http_post(
      url     := rtrim(app_url, '/') || '/api/push/cron',
      body    := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret)
    );
  exception when others then
    raise notice 'pg_net is not enabled — reminders stay in the in-app feed.';
  end;
end;
$$;

revoke execute on function public.bp_reminders_tick() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('bepair-reminders', '*/5 * * * *', 'select public.bp_reminders_tick()');
exception when others then
  raise notice 'pg_cron is not enabled — reminders are not sent. Enable it and run this file again.';
end;
$$;
