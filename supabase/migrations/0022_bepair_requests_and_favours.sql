-- Bepair 0022 — each side of a request does only its own part; asking for a
-- favour is one server step.
--
-- Requests (checklist_items). The old Lumina policy let either partner update
-- any column of any request. So the one asked could raise a request's points
-- and then mark it done, and the database would pay them (bp_task_points).
-- Now a guard says who may change what:
--   the one who asked  — the wording and the weight, while it is not done;
--                         «seen» (acknowledged) once, after it is done;
--   the one asked      — «done», once, as themselves;
--   nobody             — which space, which list, who asked; un-doing it.
-- A request can be taken back only while it is not done, so what was done
-- stays in the history (its points stay paid either way).
--
-- Favours (shop_items). Asking for one updates the partner's row, but only the
-- owner could update it, so «Попросить» never went through. bp_claim_service
-- checks the balance, takes the favour and spends the points together, under a
-- row lock: no double claim, no claim without payment, no payment without claim.
--
-- Safe to run more than once.

-- ── Requests ────────────────────────────────────────────────────────────
create or replace function public.bp_task_guard()
returns trigger
language plpgsql
as $$
declare
  me uuid := auth.uid();
begin
  -- The server (widget route, service key) and security definer functions pass.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.space_id is distinct from old.space_id
     or new.user_id is distinct from old.user_id
     or new.checklist_id is distinct from old.checklist_id then
    raise exception 'a request stays where it was made' using errcode = '42501';
  end if;
  if old.is_completed and not new.is_completed then
    raise exception 'a done request stays done' using errcode = '42501';
  end if;

  if me = old.user_id then
    -- The one who asked.
    if (new.content, new.points) is distinct from (old.content, old.points) and old.is_completed then
      raise exception 'a done request is not edited' using errcode = '42501';
    end if;
    if (new.is_completed, new.completed_by, new.completed_at) is distinct from (old.is_completed, old.completed_by, old.completed_at) then
      raise exception 'the one asked marks it done' using errcode = '42501';
    end if;
    if (new.acknowledged_at, new.acknowledged_by) is distinct from (old.acknowledged_at, old.acknowledged_by)
       and (not old.is_completed or old.acknowledged_at is not null or new.acknowledged_by is distinct from me) then
      raise exception 'seen is said once, after it is done' using errcode = '42501';
    end if;
  else
    -- The one asked: only «done», once, as themselves.
    if (new.content, new.points, new.acknowledged_at, new.acknowledged_by)
       is distinct from (old.content, old.points, old.acknowledged_at, old.acknowledged_by) then
      raise exception 'only the one who asked changes a request' using errcode = '42501';
    end if;
    if (new.is_completed, new.completed_by, new.completed_at) is distinct from (old.is_completed, old.completed_by, old.completed_at)
       and (old.is_completed or not new.is_completed or coalesce(new.completed_by, me) is distinct from me) then
      raise exception 'done is marked once, by the one asked' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Named to run first among the BEFORE triggers (they fire in name order), so
-- it sees exactly what the app sent.
drop trigger if exists bp_task_guard on public.checklist_items;
create trigger bp_task_guard
  before update on public.checklist_items
  for each row execute function public.bp_task_guard();

drop policy if exists "checklist_items: space members can update" on public.checklist_items;
drop policy if exists "checklist_items: space members can insert" on public.checklist_items;
drop policy if exists "checklist_items: owner can delete" on public.checklist_items;

drop policy if exists "bp requests: asked within the pair" on public.checklist_items;
create policy "bp requests: asked within the pair" on public.checklist_items
  for insert with check (
    user_id = auth.uid()
    and space_id = public.bp_my_space()
    and not is_completed
  );

drop policy if exists "bp requests: changed within the pair" on public.checklist_items;
create policy "bp requests: changed within the pair" on public.checklist_items
  for update using (space_id = public.bp_my_space())
  with check (space_id = public.bp_my_space());

drop policy if exists "bp requests: taken back while not done" on public.checklist_items;
create policy "bp requests: taken back while not done" on public.checklist_items
  for delete using (user_id = auth.uid() and not is_completed);

-- ── Favours ─────────────────────────────────────────────────────────────
-- 'claimed' | 'taken' | 'own' | 'not-enough' | 'no-such'
create or replace function public.bp_claim_service(item uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  sp uuid := public.bp_my_space();
  s public.shop_items;
  balance int;
begin
  if me is null or sp is null then
    return 'no-such';
  end if;
  select * into s from public.shop_items where id = item and space_id = sp for update;
  if s.id is null then
    return 'no-such';
  end if;
  if s.user_id = me then
    return 'own';
  end if;
  if s.is_claimed then
    return 'taken';
  end if;
  select coalesce(sum(amount), 0) into balance from public.points_ledger where space_id = sp and to_user = me;
  if balance < s.cost_points then
    return 'not-enough';
  end if;

  update public.shop_items set is_claimed = true, claimed_by = me, claimed_at = now() where id = item;
  insert into public.points_ledger (space_id, from_user, to_user, amount, reason, reference)
  values (sp, me, me, -s.cost_points, 'service', item::text);
  return 'claimed';
end;
$$;

grant execute on function public.bp_claim_service(uuid) to authenticated;
revoke execute on function public.bp_claim_service(uuid) from anon;

-- The owner edits, re-offers and withdraws their own favours; the row stays theirs.
drop policy if exists "shop_items: owner can update" on public.shop_items;
create policy "shop_items: owner can update" on public.shop_items
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and space_id = public.bp_my_space());
