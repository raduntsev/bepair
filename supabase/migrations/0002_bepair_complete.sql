-- Bepair / Впаре — everything the full app needs on top of 0001.
-- Run after 0001_bepair_redesign.sql. Idempotent: safe to run twice.
--
-- What changes and why, in one place:
--   1. RLS helpers as `security definer` functions. 0001's policies queried
--      day_entries from inside a day_entries policy, which Postgres rejects as
--      infinite recursion. Helpers read the table without re-entering RLS.
--   2. A per-user timezone. The database compared dates in UTC while the client
--      lives in its own zone, so an evening save in Vladivostok landed on the
--      wrong day. Now "today" is computed in the user's own zone.
--   3. Letters unseal once the recipient has marked any day since delivery —
--      not "today", which re-sealed an already-read letter every morning.
--   4. New: pings (весточки), notifications + triggers, push subscriptions,
--      paired settings with agreement, cycle days, onboarding answers,
--      task templates, couple facts, scheduled-letter delivery, media storage.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Profile columns
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists timezone        text,
  add column if not exists gender          text check (gender in ('m', 'f')),
  add column if not exists onboarded_at    timestamptz,
  add column if not exists cycle_tracking  boolean not null default false,
  add column if not exists notify_pings    boolean not null default true,
  add column if not exists notify_day      boolean not null default true,
  add column if not exists notify_tasks    boolean not null default true,
  add column if not exists notify_letters  boolean not null default true,
  add column if not exists notify_sound    boolean not null default true;

-- An unknown zone name would make `at time zone` throw inside every policy.
create or replace function public.bp_profiles_tz_guard()
returns trigger
language plpgsql
as $$
begin
  if new.timezone is not null
     and not exists (select 1 from pg_timezone_names where name = new.timezone) then
    new.timezone := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bp_profiles_tz_guard on public.profiles;
create trigger bp_profiles_tz_guard
  before insert or update of timezone on public.profiles
  for each row execute function public.bp_profiles_tz_guard();

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Helpers
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.bp_my_space()
returns uuid
language sql stable security definer set search_path = public
as $$ select space_id from public.profiles where id = auth.uid() $$;

create or replace function public.bp_partner_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select p.id from public.profiles p
  where p.space_id = public.bp_my_space() and p.id <> auth.uid()
  limit 1
$$;

create or replace function public.bp_tz(uid uuid default auth.uid())
returns text
language sql stable security definer set search_path = public
as $$ select timezone from public.profiles where id = uid $$;

create or replace function public.bp_today(uid uuid default auth.uid())
returns date
language sql stable security definer set search_path = public
as $$ select (now() at time zone coalesce(public.bp_tz(uid), 'UTC'))::date $$;

create or replace function public.bp_has_marked(d date, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.day_entries where user_id = uid and entry_date = d) $$;

create or replace function public.bp_marked_since(ts timestamptz, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.day_entries
    where user_id = uid
      and entry_date >= (ts at time zone coalesce(public.bp_tz(uid), 'UTC'))::date
  )
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Paired settings — one row per space, changed only by agreement
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.space_settings (
  space_id             uuid primary key references public.spaces (id) on delete cascade,
  reveal_first         boolean not null default true,
  chronicle_deletable  boolean not null default false,
  long_distance        boolean not null default false,
  count_streak         boolean not null default true,
  together_since       date,
  pending_key          text,
  pending_value        boolean,
  pending_by           uuid references public.profiles (id) on delete set null,
  pending_at           timestamptz,
  updated_at           timestamptz not null default now()
);

alter table public.space_settings enable row level security;

drop policy if exists "space_settings readable by members" on public.space_settings;
create policy "space_settings readable by members"
  on public.space_settings for select
  using (space_id = public.bp_my_space());
-- No insert/update policies: every change goes through the functions below.

create or replace function public.bp_reveal_first(sp uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select reveal_first from public.space_settings where space_id = sp), true) $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Notifications — facts, never content that is still sealed
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  kind        text not null check (kind in (
                'ping', 'day', 'task_new', 'task_done', 'task_seen', 'letter',
                'service', 'paired_proposal', 'paired_answer', 'joined')),
  ref_id      uuid,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  pushed_at   timestamptz
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unpushed_idx
  on public.notifications (space_id) where pushed_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications readable by recipient" on public.notifications;
create policy "notifications readable by recipient"
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications markable by recipient" on public.notifications;
create policy "notifications markable by recipient"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.bp_notify(
  recipient uuid, actor uuid, sp uuid, kind text, ref uuid, payload jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if recipient is null or recipient = actor then
    return;
  end if;
  insert into public.notifications (space_id, user_id, actor_id, kind, ref_id, payload)
  values (sp, recipient, actor, kind, ref, coalesce(payload, '{}'::jsonb));
end;
$$;

create or replace function public.bp_other_member(sp uuid, me uuid)
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.profiles where space_id = sp and id <> me limit 1 $$;

create or replace function public.bp_mark_notifications_read()
returns void
language sql security definer set search_path = public
as $$ update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null $$;

grant execute on function public.bp_mark_notifications_read() to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Settings RPCs
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.bp_settings()
returns public.space_settings
language plpgsql security definer set search_path = public
as $$
declare
  sp uuid := public.bp_my_space();
  s  public.space_settings;
begin
  if sp is null then
    return null;
  end if;
  insert into public.space_settings (space_id) values (sp) on conflict do nothing;
  select * into s from public.space_settings where space_id = sp;
  return s;
end;
$$;

create or replace function public.bp_apply_setting(sp uuid, setting text, val boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if setting not in ('reveal_first', 'chronicle_deletable', 'long_distance', 'count_streak') then
    raise exception 'unknown paired setting %', setting;
  end if;
  execute format(
    'update public.space_settings set %I = $1, pending_key = null, pending_value = null,
       pending_by = null, pending_at = null, updated_at = now() where space_id = $2',
    setting
  ) using val, sp;
end;
$$;

/*
  "Включается у обоих или ни у кого." A change proposed by one partner waits for
  the other. Alone in the space there is nobody to disagree, so it applies.
  Returns 'applied' or 'proposed'.
*/
create or replace function public.bp_propose_setting(setting text, val boolean)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  sp      uuid := public.bp_my_space();
  partner uuid := public.bp_partner_id();
  s       public.space_settings;
begin
  if sp is null then
    raise exception 'no space';
  end if;
  if setting not in ('reveal_first', 'chronicle_deletable', 'long_distance', 'count_streak') then
    raise exception 'unknown paired setting %', setting;
  end if;

  s := public.bp_settings();

  if partner is null then
    perform public.bp_apply_setting(sp, setting, val);
    return 'applied';
  end if;

  -- The partner already proposed exactly this: proposing it back is agreement.
  if s.pending_key = setting and s.pending_value = val and s.pending_by = partner then
    perform public.bp_apply_setting(sp, setting, val);
    perform public.bp_notify(partner, auth.uid(), sp, 'paired_answer', null,
      jsonb_build_object('key', setting, 'value', val, 'accepted', true));
    return 'applied';
  end if;

  update public.space_settings
     set pending_key = setting, pending_value = val, pending_by = auth.uid(), pending_at = now()
   where space_id = sp;

  perform public.bp_notify(partner, auth.uid(), sp, 'paired_proposal', null,
    jsonb_build_object('key', setting, 'value', val));
  return 'proposed';
end;
$$;

create or replace function public.bp_answer_setting(accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  sp uuid := public.bp_my_space();
  s  public.space_settings;
begin
  select * into s from public.space_settings where space_id = sp;
  if s.pending_key is null or s.pending_by = auth.uid() then
    return;
  end if;

  if accept then
    perform public.bp_apply_setting(sp, s.pending_key, s.pending_value);
  else
    update public.space_settings
       set pending_key = null, pending_value = null, pending_by = null, pending_at = null
     where space_id = sp;
  end if;

  perform public.bp_notify(s.pending_by, auth.uid(), sp, 'paired_answer', null,
    jsonb_build_object('key', s.pending_key, 'value', s.pending_value, 'accepted', accept));
end;
$$;

create or replace function public.bp_withdraw_setting()
returns void
language sql security definer set search_path = public
as $$
  update public.space_settings
     set pending_key = null, pending_value = null, pending_by = null, pending_at = null
   where space_id = public.bp_my_space() and pending_by = auth.uid()
$$;

-- Days together is a shared fact, not an access rule, so either partner may set it.
create or replace function public.bp_set_together_since(d date)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  sp uuid := public.bp_my_space();
begin
  if sp is null then
    return;
  end if;
  perform public.bp_settings();
  update public.space_settings set together_since = d, updated_at = now() where space_id = sp;
end;
$$;

grant execute on function public.bp_settings() to authenticated;
grant execute on function public.bp_propose_setting(text, boolean) to authenticated;
grant execute on function public.bp_answer_setting(boolean) to authenticated;
grant execute on function public.bp_withdraw_setting() to authenticated;
grant execute on function public.bp_set_together_since(date) to authenticated;
revoke execute on function public.bp_apply_setting(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.bp_notify(uuid, uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Day entries — the reciprocity gate, rewritten without recursion
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "day_entries readable within space" on public.day_entries;
create policy "day_entries readable within space"
  on public.day_entries for select
  using (
    user_id = auth.uid()
    or (
      space_id = public.bp_my_space()
      and (public.bp_has_marked(entry_date) or not public.bp_reveal_first(space_id))
    )
  );

/*
  Only today, in your own zone. Until the client has reported a zone, fall back
  to 0001's ±1 day window so the very first save is not rejected.
*/
drop policy if exists "day_entries writable by author" on public.day_entries;
create policy "day_entries writable by author"
  on public.day_entries for insert
  with check (
    user_id = auth.uid()
    and space_id = public.bp_my_space()
    and (
      entry_date = public.bp_today()
      or (public.bp_tz() is null and entry_date between current_date - 1 and current_date + 1)
    )
  );

drop policy if exists "day_entries editable same day" on public.day_entries;
create policy "day_entries editable same day"
  on public.day_entries for update
  using (
    user_id = auth.uid()
    and (
      entry_date = public.bp_today()
      or (public.bp_tz() is null and entry_date between current_date - 1 and current_date + 1)
    )
  )
  with check (user_id = auth.uid());

create or replace function public.day_presence_for_space(target_space uuid)
returns table (user_id uuid, entry_date date)
language sql stable security definer set search_path = public
as $$
  select d.user_id, d.entry_date
  from public.day_entries d
  where d.space_id = target_space
    and target_space = public.bp_my_space()
$$;

grant execute on function public.day_presence_for_space(uuid) to authenticated;

create or replace function public.bp_on_day_entry()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.bp_notify(public.bp_other_member(new.space_id, new.user_id),
    new.user_id, new.space_id, 'day', new.id, jsonb_build_object('date', new.entry_date));
  return new;
end;
$$;

drop trigger if exists bp_on_day_entry on public.day_entries;
create trigger bp_on_day_entry
  after insert on public.day_entries
  for each row execute function public.bp_on_day_entry();

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. Letters — delivery time, attachments, unseal once you have spoken
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.letters
  add column if not exists delivered_at timestamptz,
  add column if not exists media jsonb not null default '[]'::jsonb;

update public.letters
   set delivered_at = coalesce(deliver_at, created_at)
 where status = 'delivered' and delivered_at is null;

create or replace function public.bp_letters_stamp()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  if new.status <> 'delivered' then
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bp_letters_stamp on public.letters;
create trigger bp_letters_stamp
  before insert or update of status on public.letters
  for each row execute function public.bp_letters_stamp();

drop policy if exists "letters readable by recipient when delivered" on public.letters;
create policy "letters readable by recipient when delivered"
  on public.letters for select
  using (
    recipient_id = auth.uid()
    and delivered_at is not null
    and (
      reveal_after_day = false
      or not public.bp_reveal_first(space_id)
      or public.bp_marked_since(delivered_at)
    )
  );

drop policy if exists "letters writable by author" on public.letters;
create policy "letters writable by author"
  on public.letters for insert
  with check (author_id = auth.uid() and space_id = public.bp_my_space());

drop policy if exists "letters editable until delivered" on public.letters;
create policy "letters editable until delivered"
  on public.letters for update
  using (
    author_id = auth.uid()
    and (status = 'draft' or (status = 'scheduled' and (deliver_at is null or deliver_at > now())))
  )
  -- Sending a draft flips it to 'delivered', so the new row may be delivered.
  with check (author_id = auth.uid());

create or replace function public.letter_inbox()
returns table (id uuid, author_id uuid, created_at timestamptz, sealed boolean)
language sql stable security definer set search_path = public
as $$
  select l.id, l.author_id, l.delivered_at, true
  from public.letters l
  where l.recipient_id = auth.uid()
    and l.delivered_at is not null
    and l.reveal_after_day = true
    and public.bp_reveal_first(l.space_id)
    and not public.bp_marked_since(l.delivered_at)
$$;

grant execute on function public.letter_inbox() to authenticated;

-- The recipient cannot update a letter row, so reading goes through here.
create or replace function public.bp_mark_letter_read(letter uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.letters set is_read = true, read_at = now()
  where id = letter and recipient_id = auth.uid() and delivered_at is not null and is_read = false
$$;

grant execute on function public.bp_mark_letter_read(uuid) to authenticated;

-- Scheduled letters become delivered here: by pg_cron every minute when it is
-- available, and by every client that opens the letters list as a fallback.
create or replace function public.bp_deliver_due()
returns integer
language sql security definer set search_path = public
as $$
  with due as (
    update public.letters
       set status = 'delivered'
     where status = 'scheduled' and deliver_at is not null and deliver_at <= now()
    returning id
  )
  select count(*)::integer from due
$$;

grant execute on function public.bp_deliver_due() to authenticated;

create or replace function public.bp_on_letter_delivered()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.delivered_at is not null and (tg_op = 'INSERT' or old.delivered_at is null) then
    perform public.bp_notify(new.recipient_id, new.author_id, new.space_id, 'letter', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists bp_on_letter_delivered on public.letters;
create trigger bp_on_letter_delivered
  after insert or update of status on public.letters
  for each row execute function public.bp_on_letter_delivered();

do $$
begin
  perform cron.schedule('bepair-deliver-letters', '* * * * *', 'select public.bp_deliver_due()');
exception when others then
  raise notice 'pg_cron is not enabled — scheduled letters are delivered when the app is opened.';
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. Pings (весточки) — the chronicle's main stream
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.pings (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  body          text not null default '',
  photo_path    text,
  voice_path    text,
  voice_ms      integer,
  track_url     text,
  track_title   text,
  track_artist  text,
  created_at    timestamptz not null default now(),
  constraint pings_not_empty check (
    length(trim(body)) > 0 or photo_path is not null or voice_path is not null or track_url is not null
  )
);

create index if not exists pings_space_idx on public.pings (space_id, created_at desc);

alter table public.pings enable row level security;

drop policy if exists "pings readable within space" on public.pings;
create policy "pings readable within space"
  on public.pings for select
  using (space_id = public.bp_my_space());

drop policy if exists "pings writable by author" on public.pings;
create policy "pings writable by author"
  on public.pings for insert
  with check (author_id = auth.uid() and space_id = public.bp_my_space());

-- Sent is final unless both partners agreed that authors may remove their own.
drop policy if exists "pings deletable by author when allowed" on public.pings;
create policy "pings deletable by author when allowed"
  on public.pings for delete
  using (
    author_id = auth.uid()
    and coalesce((select chronicle_deletable from public.space_settings s where s.space_id = pings.space_id), false)
  );

create or replace function public.bp_on_ping()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.bp_notify(public.bp_other_member(new.space_id, new.author_id),
    new.author_id, new.space_id, 'ping', new.id);
  return new;
end;
$$;

drop trigger if exists bp_on_ping on public.pings;
create trigger bp_on_ping
  after insert on public.pings
  for each row execute function public.bp_on_ping();

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. Tasks and services — notifications and templates
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.bp_on_task()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.bp_notify(public.bp_other_member(new.space_id, new.user_id),
      new.user_id, new.space_id, 'task_new', new.id, jsonb_build_object('content', new.content));
  elsif new.is_completed and not coalesce(old.is_completed, false) then
    perform public.bp_notify(new.user_id, new.completed_by, new.space_id, 'task_done', new.id,
      jsonb_build_object('content', new.content));
  elsif new.acknowledged_at is not null and old.acknowledged_at is null then
    perform public.bp_notify(new.completed_by, new.user_id, new.space_id, 'task_seen', new.id,
      jsonb_build_object('content', new.content));
  end if;
  return new;
end;
$$;

drop trigger if exists bp_on_task on public.checklist_items;
create trigger bp_on_task
  after insert or update of is_completed, acknowledged_at on public.checklist_items
  for each row execute function public.bp_on_task();

create or replace function public.bp_on_service_claim()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.is_claimed and not coalesce(old.is_claimed, false) then
    perform public.bp_notify(new.user_id, new.claimed_by, new.space_id, 'service', new.id,
      jsonb_build_object('title', new.title));
  end if;
  return new;
end;
$$;

drop trigger if exists bp_on_service_claim on public.shop_items;
create trigger bp_on_service_claim
  after update of is_claimed on public.shop_items
  for each row execute function public.bp_on_service_claim();

create table if not exists public.task_templates (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  content     text not null,
  points      integer not null default 2,
  created_at  timestamptz not null default now()
);

alter table public.task_templates enable row level security;

drop policy if exists "bp task_templates readable within space" on public.task_templates;
create policy "bp task_templates readable within space"
  on public.task_templates for select
  using (space_id = public.bp_my_space());

drop policy if exists "bp task_templates writable by author" on public.task_templates;
create policy "bp task_templates writable by author"
  on public.task_templates for insert
  with check (user_id = auth.uid() and space_id = public.bp_my_space());

drop policy if exists "bp task_templates deletable by author" on public.task_templates;
create policy "bp task_templates deletable by author"
  on public.task_templates for delete
  using (user_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. Joining — tell the one who was waiting
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.bp_on_join()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.space_id is not null and old.space_id is distinct from new.space_id then
    perform public.bp_notify(public.bp_other_member(new.space_id, new.id),
      new.id, new.space_id, 'joined', null);
  end if;
  return new;
end;
$$;

drop trigger if exists bp_on_join on public.profiles;
create trigger bp_on_join
  after update of space_id on public.profiles
  for each row execute function public.bp_on_join();

-- ═════════════════════════════════════════════════════════════════════════════
-- 11. Personal data: cycle days and onboarding answers
-- ═════════════════════════════════════════════════════════════════════════════

-- Cycle days belong to their author alone — the partner has no read policy at all.
create table if not exists public.cycle_days (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  day       date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.cycle_days enable row level security;

drop policy if exists "cycle_days private" on public.cycle_days;
create policy "cycle_days private"
  on public.cycle_days for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- "Ответ увидит только партнёр": readable inside the space, written by its author.
create table if not exists public.couple_answers (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  space_id    uuid not null references public.spaces (id) on delete cascade,
  question    smallint not null check (question between 1 and 8),
  answer      text not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, question)
);

alter table public.couple_answers enable row level security;

drop policy if exists "couple_answers readable within space" on public.couple_answers;
create policy "couple_answers readable within space"
  on public.couple_answers for select
  using (space_id = public.bp_my_space());

drop policy if exists "couple_answers writable by author" on public.couple_answers;
create policy "couple_answers writable by author"
  on public.couple_answers for insert
  with check (user_id = auth.uid() and space_id = public.bp_my_space());

drop policy if exists "couple_answers editable by author" on public.couple_answers;
create policy "couple_answers editable by author"
  on public.couple_answers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and space_id = public.bp_my_space());

-- ═════════════════════════════════════════════════════════════════════════════
-- 12. Couple facts — what you did together, never compared against each other
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.bp_couple_facts()
returns table (letters integer, pings integer, tasks_done integer, both_days integer)
language sql stable security definer set search_path = public
as $$
  with sp as (select public.bp_my_space() as id)
  select
    (select count(*) from public.letters l, sp where l.space_id = sp.id and l.delivered_at is not null)::integer,
    (select count(*) from public.pings p, sp where p.space_id = sp.id)::integer,
    (select count(*) from public.checklist_items c, sp where c.space_id = sp.id and c.is_completed)::integer,
    (select count(*) from (
       select d.entry_date from public.day_entries d, sp
       where d.space_id = sp.id
       group by d.entry_date having count(distinct d.user_id) = 2
     ) both_marked)::integer
$$;

grant execute on function public.bp_couple_facts() to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 13. Push subscriptions — one row per device
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions own" on public.push_subscriptions;
create policy "push_subscriptions own"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- 14. Media storage — private bucket, one folder per space
-- ═════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit)
values ('bepair', 'bepair', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "bepair media readable within space" on storage.objects;
create policy "bepair media readable within space"
  on storage.objects for select
  using (bucket_id = 'bepair' and (storage.foldername(name))[1] = public.bp_my_space()::text);

drop policy if exists "bepair media uploadable within space" on storage.objects;
create policy "bepair media uploadable within space"
  on storage.objects for insert
  with check (bucket_id = 'bepair' and (storage.foldername(name))[1] = public.bp_my_space()::text);

drop policy if exists "bepair media removable by owner" on storage.objects;
create policy "bepair media removable by owner"
  on storage.objects for delete
  using (bucket_id = 'bepair' and owner = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- 15. Realtime — the day and the bell update without a reload
-- ═════════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array['notifications', 'day_entries', 'pings', 'checklist_items', 'space_settings'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then
      null; -- already published, or realtime is not set up
    end;
  end loop;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 16. A profile for every new account
-- ═════════════════════════════════════════════════════════════════════════════
-- Google sign-in and magic links both create an auth user; without a profile row
-- the app cannot attach the person to a space. `on conflict do nothing` keeps
-- this harmless next to any trigger the project already had.

create or replace function public.bp_handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(split_part(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), ' ', 1), ''),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists bp_on_auth_user_created on auth.users;
create trigger bp_on_auth_user_created
  after insert on auth.users
  for each row execute function public.bp_handle_new_user();

insert into public.profiles (id, display_name)
select u.id, '' from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
