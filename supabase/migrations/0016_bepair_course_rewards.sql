-- Bepair / Впаре — rewards for the courses: points, badges, a run of days.
-- Run after 0015. Idempotent: safe to run again.
--
-- Points go into the same points_ledger as requests and favours, so they can
-- be spent on the partner's favours:
--   a lesson done       +2   (course_lesson, written by a trigger on course_steps)
--   a module finished   +10  (course_module, through bp_course_milestone)
--   the course finished +30  (course_done,   through bp_course_milestone)
-- Each is paid once: a partial unique index on (to_user, reason, reference).
-- Badges need no table — a module is earned when all its lessons are done,
-- which course_steps already says. The run of days needs course_days.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Days with the course, for the run
-- ═════════════════════════════════════════════════════════════════════════════
-- One row per person per local day on which they answered or finished a step.
-- The app writes the day in the person's own time zone.

create table if not exists public.course_days (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  space_id  uuid not null references public.spaces (id) on delete cascade,
  day       date not null,
  primary key (user_id, day)
);

alter table public.course_days enable row level security;

drop policy if exists "course_days readable within space" on public.course_days;
create policy "course_days readable within space" on public.course_days
  for select using (space_id = public.bp_my_space());
drop policy if exists "course_days written by owner" on public.course_days;
create policy "course_days written by owner" on public.course_days
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and space_id = public.bp_my_space()
              and day between current_date - 1 and current_date + 1);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Course points, paid once
-- ═════════════════════════════════════════════════════════════════════════════

create unique index if not exists points_ledger_course_once
  on public.points_ledger (to_user, reason, reference)
  where reason in ('course_lesson', 'course_module', 'course_done');

create or replace function public.bp_course_pay(who uuid, sp uuid, why text, ref text, pts integer)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  insert into public.points_ledger (space_id, from_user, to_user, amount, reason, reference)
  values (sp, null, who, pts, why, ref)
  on conflict (to_user, reason, reference) where reason in ('course_lesson', 'course_module', 'course_done')
  do nothing;
  get diagnostics n = row_count;
  return case when n > 0 then pts else 0 end;
end;
$$;

revoke execute on function public.bp_course_pay(uuid, uuid, text, text, integer) from public, anon, authenticated;

create or replace function public.bp_on_course_step_points()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.bp_course_pay(new.user_id, new.space_id, 'course_lesson', new.course_id || '/' || new.lesson_id, 2);
  return new;
end;
$$;

revoke execute on function public.bp_on_course_step_points() from public, anon, authenticated;

drop trigger if exists bp_on_course_step_points on public.course_steps;
create trigger bp_on_course_step_points
  after insert on public.course_steps
  for each row execute function public.bp_on_course_step_points();

-- Steps done before this migration are paid too.
insert into public.points_ledger (space_id, from_user, to_user, amount, reason, reference)
select s.space_id, null, s.user_id, 2, 'course_lesson', s.course_id || '/' || s.lesson_id
from public.course_steps s
on conflict (to_user, reason, reference) where reason in ('course_lesson', 'course_module', 'course_done')
do nothing;

-- A module or the whole course, claimed by the app the moment its last step is
-- done. Course content lives in the app, so the app says how many steps the
-- module has; the database checks that this many are actually done.
create or replace function public.bp_course_milestone(course text, milestone text, steps integer)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  me    uuid := auth.uid();
  sp    uuid := public.bp_my_space();
  done  integer;
begin
  if me is null or sp is null or steps is null or steps < 1 then
    return 0;
  end if;

  if milestone = 'course' then
    select count(*) into done from public.course_steps
     where user_id = me and course_id = course;
    if done < steps then
      return 0;
    end if;
    return public.bp_course_pay(me, sp, 'course_done', course, 30);
  end if;

  select count(*) into done from public.course_steps
   where user_id = me and course_id = course
     and (lesson_id = milestone or lesson_id like milestone || '-%');
  if done < steps then
    return 0;
  end if;
  return public.bp_course_pay(me, sp, 'course_module', course || '/' || milestone, 10);
end;
$$;

revoke execute on function public.bp_course_milestone(text, text, integer) from public, anon;
grant execute on function public.bp_course_milestone(text, text, integer) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Spending points on a favour
-- ═════════════════════════════════════════════════════════════════════════════
-- The app writes the spend itself (store page: amount = −cost, reason
-- 'service'), but points_ledger had no insert policy, so asking for a favour
-- failed and was rolled back. This allows exactly that row and nothing else:
-- your own spend, for a favour in your space that you have just claimed, at its
-- price.

drop policy if exists "ledger: spend on a claimed favour" on public.points_ledger;
create policy "ledger: spend on a claimed favour" on public.points_ledger
  for insert
  with check (
    reason = 'service'
    and to_user = auth.uid()
    and from_user = auth.uid()
    and space_id = public.bp_my_space()
    and exists (
      select 1 from public.shop_items s
      where s.id::text = points_ledger.reference
        and s.space_id = points_ledger.space_id
        and s.is_claimed
        and s.claimed_by = auth.uid()
        and points_ledger.amount = -s.cost_points
    )
  );
