-- Bepair 0024 — «Ссора» и «Близость»: two shared marks on a couple's day.
-- Run after 0023. Idempotent.
--
-- A mark belongs to the pair, not to one person: either partner sets it, both
-- see it, either takes it off. One row per space, day and kind.
--
-- «Близость» is information about intimate life — a special category under
-- ст. 10 152-ФЗ — so it is off until each partner gives a separate consent
-- (profiles.intimacy_consent_at, written only by bp_give_consent). The marks
-- exist only while BOTH have it: the rule lives in RLS, not in the interface.
-- Withdrawing by either partner, or leaving the pair, deletes the couple's
-- intimacy marks (ч. 5 ст. 21: processing stops and the data is destroyed).
--
-- «Ссора» is ordinary content of the day under the general consent.

alter table public.profiles add column if not exists intimacy_consent_at timestamptz;

create table if not exists public.day_events (
  space_id   uuid not null references public.spaces (id) on delete cascade,
  day        date not null,
  kind       text not null check (kind in ('quarrel', 'intimacy')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (space_id, day, kind)
);

alter table public.day_events enable row level security;

-- Both members of the space have the intimacy consent on record.
create or replace function public.bp_intimacy_mutual(sp uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select count(*) = 2 and bool_and(intimacy_consent_at is not null)
  from public.profiles
  where space_id = sp
$$;

drop policy if exists "day events readable by the pair" on public.day_events;
create policy "day events readable by the pair" on public.day_events
  for select to authenticated
  using (space_id = public.bp_my_space() and (kind = 'quarrel' or public.bp_intimacy_mutual(space_id)));

drop policy if exists "day events set by the pair" on public.day_events;
create policy "day events set by the pair" on public.day_events
  for insert to authenticated
  with check (
    space_id = public.bp_my_space()
    and created_by = auth.uid()
    and (kind = 'quarrel' or public.bp_intimacy_mutual(space_id))
  );

drop policy if exists "day events removed by the pair" on public.day_events;
create policy "day events removed by the pair" on public.day_events
  for delete to authenticated
  using (space_id = public.bp_my_space() and (kind = 'quarrel' or public.bp_intimacy_mutual(space_id)));

-- Whether each side has switched «Близость» on: the app shows the toggle, or
-- «ждём партнёра», without reading the partner's consent columns directly.
create or replace function public.bp_intimacy_state()
returns table (mine boolean, partner boolean)
language sql stable security definer set search_path = public
as $$
  select
    coalesce((select intimacy_consent_at is not null from public.profiles where id = auth.uid()), false),
    coalesce((select bool_or(intimacy_consent_at is not null) from public.profiles
              where space_id = public.bp_my_space() and id <> auth.uid()), false)
$$;

grant execute on function public.bp_intimacy_state() to authenticated;
revoke execute on function public.bp_intimacy_state() from anon;

-- The consent columns change only through the functions below (extends 0023).
create or replace function public.bp_profiles_consent_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (new.consent_version, new.consent_at, new.health_consent_at, new.intimacy_consent_at)
     is distinct from (old.consent_version, old.consent_at, old.health_consent_at, old.intimacy_consent_at) then
    raise exception 'consents change only through bp_give_consent and the bp_withdraw_* functions'
      using errcode = '42501';
  end if;
  if new.cycle_tracking and not coalesce(old.cycle_tracking, false) and new.health_consent_at is null then
    raise exception 'cycle tracking needs the health consent first' using errcode = '42501';
  end if;
  return new;
end;
$$;

alter table public.bp_consent_log drop constraint if exists bp_consent_log_kind_check;
alter table public.bp_consent_log add constraint bp_consent_log_kind_check
  check (kind in ('personal', 'health', 'intimacy'));

-- kind: 'personal' (with the document's version), 'health' or 'intimacy'.
create or replace function public.bp_give_consent(kind text, version text, agent text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if kind not in ('personal', 'health', 'intimacy') or coalesce(trim(version), '') = '' then
    raise exception 'unknown consent' using errcode = '22023';
  end if;

  if kind = 'personal' then
    update public.profiles set consent_version = version, consent_at = now() where id = me;
  elsif kind = 'health' then
    update public.profiles set health_consent_at = now() where id = me;
  else
    update public.profiles set intimacy_consent_at = now() where id = me;
  end if;
  insert into public.bp_consent_log (user_id, kind, version, action, user_agent)
  values (me, kind, version, 'given', left(agent, 500));
end;
$$;

create or replace function public.bp_withdraw_intimacy_consent(version text default '', agent text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  sp uuid := public.bp_my_space();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.profiles set intimacy_consent_at = null where id = me;
  if sp is not null then
    delete from public.day_events where space_id = sp and kind = 'intimacy';
  end if;
  insert into public.bp_consent_log (user_id, kind, version, action, user_agent)
  values (me, 'intimacy', coalesce(nullif(version, ''), '-'), 'withdrawn', left(agent, 500));
end;
$$;

grant execute on function public.bp_withdraw_intimacy_consent(text, text) to authenticated;
revoke execute on function public.bp_withdraw_intimacy_consent(text, text) from anon;

-- Leaving the pair ends it too: the consent was given for one partner, not any,
-- and the old space's intimacy marks go with it.
create or replace function public.bp_intimacy_cleanup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.space_id is distinct from old.space_id then
    if old.intimacy_consent_at is not null then
      new.intimacy_consent_at := null;
      insert into public.bp_consent_log (user_id, kind, version, action)
      values (new.id, 'intimacy', 'left-pair', 'withdrawn');
    end if;
    if old.space_id is not null then
      delete from public.day_events where space_id = old.space_id and kind = 'intimacy';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bp_intimacy_cleanup on public.profiles;
create trigger bp_intimacy_cleanup
  before update of space_id on public.profiles
  for each row execute function public.bp_intimacy_cleanup();

-- The partner's tap shows up without a reload.
do $$
begin
  alter publication supabase_realtime add table public.day_events;
exception when others then
  null; -- already published, or realtime is not set up
end;
$$;
