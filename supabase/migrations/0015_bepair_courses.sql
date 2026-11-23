-- Bepair / Впаре — courses, the self-reflection journal and course reminders.
-- Run after 0014. Idempotent: safe to run again.
--
-- A course is content in the app (src/lib/courses.ts); the database only keeps
-- what each person did with it:
--
--   course_enrolments  you started a course (and when you finished it)
--   course_steps       a lesson you marked as done — your partner always sees these
--   course_answers     what you wrote in a lesson — hidden from your partner
--   journal_entries    free notes and the thought diary — hidden the same way
--   course_prefs       one switch «my answers are open to my partner», and the reminder
--
-- Privacy is all or nothing, on purpose: one switch per person opens every
-- answer and journal entry to the partner at once, or none. It is enforced by
-- row-level security, so a hidden answer is never delivered to the partner's
-- browser at all. Progress (which lesson you are on) is always shared.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Tables
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.course_prefs (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  space_id        uuid not null references public.spaces (id) on delete cascade,
  share_answers   boolean not null default false,
  notify_partner  boolean not null default true,
  remind          boolean not null default false,
  remind_at       time not null default '20:00',
  -- 0 = Sunday, as in JS Date.getDay() and extract(dow …)
  remind_days     smallint[] not null default '{1,2,3,4,5,6,0}',
  reminded_on     date,
  updated_at      timestamptz not null default now()
);

create table if not exists public.course_enrolments (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  space_id     uuid not null references public.spaces (id) on delete cascade,
  course_id    text not null check (length(course_id) between 1 and 64),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  primary key (user_id, course_id)
);

create table if not exists public.course_steps (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  space_id   uuid not null references public.spaces (id) on delete cascade,
  course_id  text not null check (length(course_id) between 1 and 64),
  lesson_id  text not null check (length(lesson_id) between 1 and 64),
  done_at    timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);

create table if not exists public.course_answers (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  space_id    uuid not null references public.spaces (id) on delete cascade,
  course_id   text not null check (length(course_id) between 1 and 64),
  lesson_id   text not null check (length(lesson_id) between 1 and 64),
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) < 200000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);

create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  space_id    uuid not null references public.spaces (id) on delete cascade,
  kind        text not null default 'note' check (kind in ('note', 'thought')),
  body        text not null default '' check (length(body) <= 20000),
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) < 50000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists course_steps_space_idx on public.course_steps (space_id, course_id);
create index if not exists course_answers_space_idx on public.course_answers (space_id, user_id);
create index if not exists journal_entries_space_idx on public.journal_entries (space_id, user_id, created_at desc);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Who may read what
-- ═════════════════════════════════════════════════════════════════════════════

-- True when this person has opened their answers to their partner.
create or replace function public.bp_course_shared(owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select share_answers from public.course_prefs where user_id = owner), false) $$;

grant execute on function public.bp_course_shared(uuid) to authenticated;

alter table public.course_prefs enable row level security;
alter table public.course_enrolments enable row level security;
alter table public.course_steps enable row level security;
alter table public.course_answers enable row level security;
alter table public.journal_entries enable row level security;

-- Prefs, enrolments and steps: the couple reads both; each writes only their own.
do $$
declare
  t text;
begin
  foreach t in array array['course_prefs', 'course_enrolments', 'course_steps'] loop
    execute format('drop policy if exists "%s readable within space" on public.%I', t, t);
    execute format('create policy "%s readable within space" on public.%I for select using (space_id = public.bp_my_space())', t, t);
    execute format('drop policy if exists "%s written by owner" on public.%I', t, t);
    execute format(
      'create policy "%s written by owner" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid() and space_id = public.bp_my_space())',
      t, t
    );
  end loop;
end;
$$;

-- Answers and journal: yours always; your partner's only while they share.
do $$
declare
  t text;
begin
  foreach t in array array['course_answers', 'journal_entries'] loop
    execute format('drop policy if exists "%s readable by owner or when shared" on public.%I', t, t);
    execute format(
      'create policy "%s readable by owner or when shared" on public.%I for select using (user_id = auth.uid() or (space_id = public.bp_my_space() and public.bp_course_shared(user_id)))',
      t, t
    );
    execute format('drop policy if exists "%s written by owner" on public.%I', t, t);
    execute format(
      'create policy "%s written by owner" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid() and space_id = public.bp_my_space())',
      t, t
    );
  end loop;
end;
$$;

-- Live: the partner's step appears on your course page as it happens.
-- Answers are not published: Realtime would check RLS per row anyway, but a
-- hidden answer has no business being in the stream at all.
do $$
begin
  alter publication supabase_realtime add table public.course_steps;
exception when others then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.course_prefs;
exception when others then null;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Notifications: a partner's step, a partner opening their answers, a reminder
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'ping', 'day', 'task_new', 'task_done', 'task_seen', 'letter',
  'service', 'paired_proposal', 'paired_answer', 'joined',
  'remind_morning', 'remind_evening',
  'course_step', 'course_shared', 'remind_course'));

create or replace function public.bp_on_course_step()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.bp_notify(public.bp_other_member(new.space_id, new.user_id),
    new.user_id, new.space_id, 'course_step', null,
    jsonb_build_object('course_id', new.course_id, 'lesson_id', new.lesson_id));
  return new;
end;
$$;

drop trigger if exists bp_on_course_step on public.course_steps;
create trigger bp_on_course_step
  after insert on public.course_steps
  for each row execute function public.bp_on_course_step();

create or replace function public.bp_on_course_share()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.share_answers and (tg_op = 'INSERT' or not old.share_answers) then
    perform public.bp_notify(public.bp_other_member(new.space_id, new.user_id),
      new.user_id, new.space_id, 'course_shared', null, '{}'::jsonb);
  end if;
  return new;
end;
$$;

drop trigger if exists bp_on_course_share on public.course_prefs;
create trigger bp_on_course_share
  after insert or update of share_answers on public.course_prefs
  for each row execute function public.bp_on_course_share();

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Course reminders
-- ═════════════════════════════════════════════════════════════════════════════
-- On the days you chose, at your time, at most once a day — and only when there
-- is a reason: a course you started and have not finished, and nothing done in
-- it yet today. Same three-hour window as the morning and evening reminders.

create or replace function public.bp_queue_course_reminders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r         record;
  sent      integer := 0;
  tz        text;
  local_ts  timestamp;
  local_d   date;
  local_t   time;
  course    text;
  last_one  text;
begin
  for r in
    select c.user_id, c.space_id, c.remind_at, c.remind_days, c.reminded_on, p.timezone
    from public.course_prefs c
    join public.profiles p on p.id = c.user_id
    where c.remind and p.space_id is not null and p.space_id = c.space_id
  loop
    tz := coalesce(r.timezone, 'UTC');
    local_ts := now() at time zone tz;
    local_d  := local_ts::date;
    local_t  := local_ts::time;

    continue when r.reminded_on is not distinct from local_d;
    continue when not (extract(dow from local_d)::smallint = any (r.remind_days));
    continue when local_t < r.remind_at or local_t - r.remind_at >= interval '3 hours';

    -- The course started most recently and not finished yet.
    select e.course_id into course
    from public.course_enrolments e
    where e.user_id = r.user_id and e.finished_at is null
    order by e.started_at desc
    limit 1;
    continue when course is null;

    -- Already worked on it today: no reason to remind.
    continue when exists (
      select 1 from public.course_steps s
      where s.user_id = r.user_id and (s.done_at at time zone tz)::date = local_d);
    continue when exists (
      select 1 from public.course_answers a
      where a.user_id = r.user_id and (a.updated_at at time zone tz)::date = local_d);

    select s.lesson_id into last_one
    from public.course_steps s
    where s.user_id = r.user_id and s.course_id = course
    order by s.done_at desc
    limit 1;

    perform public.bp_notify(r.user_id, null, r.space_id, 'remind_course', null,
      jsonb_build_object('course_id', course, 'last_lesson', last_one));
    update public.course_prefs set reminded_on = local_d where user_id = r.user_id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.bp_queue_course_reminders() from public, anon, authenticated;

-- The five-minute tick from 0004, now queueing both kinds before the push hop.
create or replace function public.bp_reminders_tick()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  app_url text;
  secret  text;
begin
  perform public.bp_queue_reminders();
  perform public.bp_queue_course_reminders();

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
