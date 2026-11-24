-- Bepair / Впаре — points for a request, paid once, by the database.
-- Run after 0016. Idempotent: safe to run again.
--
-- Before this, two things paid for a finished request:
--   · a legacy trigger from the old schema, on_checklist_item_completed →
--     handle_item_completion() → award_points(), which wrote a ledger row with
--     reason 'Выполнено: …' and bumped profiles.total_balance;
--   · the app, which inserted its own row with reason 'task'.
-- points_ledger has no insert policy for 'task', so in the app the second
-- insert was refused and the request was rolled back with «Баллы не
-- начислились», while the trigger's row stayed — every retry paid again. From
-- the widget (service key, no auth.uid()) award_points() could not find the
-- space and raised, so ticking a request there did nothing at all.
--
-- Now the database alone pays: when a request becomes done, the person it was
-- asked of gets its points (reason 'task', reference = the request's id).
-- A partial unique index makes a second payment impossible, and un-doing a
-- request takes its payment back, so a ledger row exists exactly while the
-- request is done. The app only flips is_completed.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. The legacy path goes
-- ═════════════════════════════════════════════════════════════════════════════
-- Nothing else calls these. The balance is the sum of points_ledger, not
-- profiles.total_balance, which is no longer written (the column stays).

drop trigger if exists on_checklist_item_completed on public.checklist_items;
drop function if exists public.handle_item_completion();
drop function if exists public.award_points(uuid, integer, text, text);

-- Rows the legacy trigger already wrote become ordinary task payments, so the
-- index below counts them and a request paid that way is never paid again.
-- Only the first row per request is converted; any extra ones are left as they
-- are (outside the index), not deleted.
with firsts as (
  select distinct on (l.reference) l.id
  from public.points_ledger l
  where l.reason like 'Выполнено: %'
    and l.reference is not null
    and not exists (select 1 from public.points_ledger t where t.reason = 'task' and t.reference = l.reference)
  order by l.reference, l.created_at, l.id
)
update public.points_ledger set reason = 'task' where id in (select id from firsts);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Paid once
-- ═════════════════════════════════════════════════════════════════════════════

create unique index if not exists points_ledger_task_once
  on public.points_ledger (reference)
  where reason = 'task';

-- Before the row is written: whoever ticked it, and when, if the caller did not
-- say (the legacy trigger used to do this).
create or replace function public.bp_task_stamp()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.is_completed and not old.is_completed then
    new.completed_by := coalesce(new.completed_by, auth.uid(), public.bp_other_member(new.space_id, new.user_id));
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$$;

revoke execute on function public.bp_task_stamp() from public, anon, authenticated;

drop trigger if exists bp_task_stamp on public.checklist_items;
create trigger bp_task_stamp
  before update of is_completed on public.checklist_items
  for each row execute function public.bp_task_stamp();

-- After it: pay, or take the payment back. The points go to the person the
-- request was made of — the other member of the requester's space — never to
-- the requester, whoever set completed_by.
create or replace function public.bp_task_points()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  doer uuid;
begin
  if new.is_completed and not old.is_completed then
    doer := public.bp_other_member(new.space_id, new.user_id);
    if doer is not null and new.points > 0 then
      insert into public.points_ledger (space_id, from_user, to_user, amount, reason, reference)
      values (new.space_id, new.user_id, doer, new.points, 'task', new.id::text)
      on conflict (reference) where reason = 'task' do nothing;
    end if;
  elsif old.is_completed and not new.is_completed then
    delete from public.points_ledger where reason = 'task' and reference = new.id::text;
  end if;
  return new;
end;
$$;

revoke execute on function public.bp_task_points() from public, anon, authenticated;

drop trigger if exists bp_task_points on public.checklist_items;
create trigger bp_task_points
  after update of is_completed on public.checklist_items
  for each row execute function public.bp_task_points();

-- Requests already done but never paid (the app's insert was refused) are paid
-- now, once.
insert into public.points_ledger (space_id, from_user, to_user, amount, reason, reference)
select c.space_id, c.user_id, o.id, c.points, 'task', c.id::text
from public.checklist_items c
join lateral (select public.bp_other_member(c.space_id, c.user_id) as id) o on o.id is not null
where c.is_completed and c.points > 0
on conflict (reference) where reason = 'task' do nothing;
