-- Bepair 0020 — membership through the server only; leaving the pair alone;
-- deleting your account.
--
-- 1. Who is in which space was decided by the browser: any signed-in person
--    could list every space (and its invite code) and write any space_id into
--    their own profile, even a full one. From now on spaces are visible only
--    to their members, and a profile changes space only inside the functions
--    below (or from the server with the service key).
-- 2. bp_leave_space: one person can leave without the other's consent. The
--    shared history stays with the one who stays; the space is closed, so
--    nobody new can join it and read what the two of you wrote.
-- 3. bp_account_files / bp_delete_account_data: the server deletes an account
--    and everything its owner wrote (route /api/account/delete).
--
-- Safe to run more than once.

-- ── Spaces: members only ────────────────────────────────────────────────
alter table public.spaces add column if not exists closed_at   timestamptz;
alter table public.spaces add column if not exists left_name   text;
alter table public.spaces add column if not exists left_gender text;

drop policy if exists "spaces: anyone can view" on public.spaces;
drop policy if exists "spaces: anyone can insert" on public.spaces;
drop policy if exists "spaces: members can view" on public.spaces;
create policy "spaces: members can view" on public.spaces
  for select to authenticated using (id = public.bp_my_space());

-- Old Lumina helpers, server-only and unused: join_space moved any user into
-- any space; leave_space's «wipe_mine» compared user_id with itself and would
-- have deleted everyone's rows.
drop function if exists public.join_space(text, uuid);
drop function if exists public.leave_space(text, uuid);

-- ── A profile changes space only through the server ─────────────────────
-- Inside a security definer function current_user is its owner, and the
-- server's service key is service_role: only a direct request from the app
-- arrives here as authenticated or anon.
create or replace function public.bp_profiles_space_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (tg_op = 'INSERT' and new.space_id is not null
          or tg_op = 'UPDATE' and new.space_id is distinct from old.space_id) then
    raise exception 'space membership changes only through bp_create_space, bp_join_space or bp_leave_space'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists bp_profiles_space_guard on public.profiles;
create trigger bp_profiles_space_guard
  before insert or update of space_id on public.profiles
  for each row execute function public.bp_profiles_space_guard();

-- ── Create, join ────────────────────────────────────────────────────────
create or replace function public.bp_create_space(space_name text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  sp uuid;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if public.bp_my_space() is not null then
    raise exception 'already in a space' using errcode = 'P0001';
  end if;

  insert into public.spaces (name) values (coalesce(nullif(trim(space_name), ''), 'Наше пространство'))
  returning id into sp;
  update public.profiles set space_id = sp where id = me;
  insert into public.wallet (space_id, balance) values (sp, 0);
  insert into public.space_settings (space_id) values (sp) on conflict do nothing;
  return sp;
end;
$$;

-- 'joined' | 'no-such-code' | 'full' | 'closed' | 'already-in-space'
create or replace function public.bp_join_space(code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  s public.spaces;
  members int;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if public.bp_my_space() is not null then
    return 'already-in-space';
  end if;

  -- The row lock makes two people tapping the same link at once take turns.
  select * into s from public.spaces where invite_code = lower(trim(code)) for update;
  if s.id is null then
    return 'no-such-code';
  end if;
  if s.closed_at is not null then
    return 'closed';
  end if;
  select count(*) into members from public.profiles where space_id = s.id;
  if members >= 2 then
    return 'full';
  end if;

  update public.profiles set space_id = s.id where id = me;
  return 'joined';
end;
$$;

grant execute on function public.bp_create_space(text) to authenticated;
grant execute on function public.bp_join_space(text) to authenticated;
revoke execute on function public.bp_create_space(text) from anon;
revoke execute on function public.bp_join_space(text) from anon;

-- ── Leaving ─────────────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'ping', 'day', 'task_new', 'task_done', 'task_seen', 'letter',
  'service', 'paired_proposal', 'paired_answer', 'joined',
  'remind_morning', 'remind_evening',
  'course_step', 'course_shared', 'remind_course',
  'location_shared', 'left'));

-- Shared by the app (bp_leave_space) and the server (account deletion).
-- Unlinks the person, closes the space to newcomers, tells the partner.
-- Their location goes with them: bp_location_cleanup fires on the space change.
create or replace function public.bp_leave(uid uuid, deleting boolean default false)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  partner uuid;
begin
  select * into me from public.profiles where id = uid;
  if me.space_id is null then
    return 'no-space';
  end if;
  partner := public.bp_other_member(me.space_id, uid);
  if partner is null then
    -- Alone: there is nobody to leave the history to; deleting the space is the way out.
    return 'alone';
  end if;

  update public.spaces
     set closed_at = now(), left_name = me.display_name, left_gender = me.gender
   where id = me.space_id;

  -- A question asked of the partner can no longer be answered by anyone.
  update public.space_settings
     set pending_key = null, pending_value = null, pending_by = null, pending_at = null, updated_at = now()
   where space_id = me.space_id;

  -- The partner hears it from the space, not from the person: the payload
  -- carries the name, because the person is no longer theirs to look up.
  perform public.bp_notify(partner, uid, me.space_id, 'left', null,
    jsonb_build_object('name', me.display_name, 'gender', me.gender, 'deleted', deleting));

  update public.profiles
     set space_id = null,
         avatar_url = case when avatar_url like me.space_id::text || '/%' then null else avatar_url end
   where id = uid;

  -- A widget on this phone would keep showing the old space.
  delete from public.widget_tokens where user_id = uid;
  return 'left';
end;
$$;

revoke execute on function public.bp_leave(uuid, boolean) from public, anon, authenticated;
grant execute on function public.bp_leave(uuid, boolean) to service_role;

create or replace function public.bp_leave_space()
returns text
language sql security definer set search_path = public
as $$ select public.bp_leave(auth.uid(), false) $$;

grant execute on function public.bp_leave_space() to authenticated;
revoke execute on function public.bp_leave_space() from anon;

-- ── Deleting an account ─────────────────────────────────────────────────
-- Every stored file the person put there: what they wrote stays theirs to delete.
create or replace function public.bp_account_files(uid uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(distinct path) filter (where path is not null and path <> ''), '{}')
  from (
    select avatar_url as path from public.profiles where id = uid
    union all select photo_path from public.pings where author_id = uid
    union all select voice_path from public.pings where author_id = uid
    union all select path from public.album_photos where added_by = uid
    union all select storage_path from public.audio_notes where user_id = uid
    union all select file_url from public.letters where author_id = uid and file_url not like 'http%'
    union all select unnest(attachments) from public.letters where author_id = uid
    union all select m->>'path' from public.letters l, jsonb_array_elements(
      case when jsonb_typeof(l.media) = 'array' then l.media else '[]'::jsonb end) m
      where l.author_id = uid
  ) files
  where path not like 'http%';
$$;

revoke execute on function public.bp_account_files(uuid) from public, anon, authenticated;
grant execute on function public.bp_account_files(uuid) to service_role;

-- The rows. Most go with the profile by cascade; these carry the person's id
-- without a cascading key, or hold a key that would block the delete.
create or replace function public.bp_delete_account_data(uid uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  sp uuid;
begin
  select space_id into sp from public.profiles where id = uid;
  if sp is not null and public.bp_leave(uid, true) = 'alone' then
    -- Alone in the space: the space goes too (its files were removed by the route).
    perform public.bp_reset_space(sp);
  end if;

  delete from public.letters where author_id = uid;
  delete from public.task_templates where user_id = uid;
  delete from public.shop_requests where requester_id = uid;
  delete from public.shop_purchases where buyer_id = uid or seller_id = uid;
  delete from public.shop_items where user_id = uid;
  delete from public.daily_metrics where user_id = uid;
  delete from public.daily_pulse where user_id = uid;
  delete from public.album_photos where added_by = uid;

  -- Keys without "on delete": requests addressed to the person, and marks
  -- they left on the partner's rows.
  delete from public.checklists where target_user_id = uid;
  update public.checklist_items set acknowledged_by = null where acknowledged_by = uid;
  update public.shop_items set claimed_by = null, is_claimed = false where claimed_by = uid;

  delete from public.profiles where id = uid;
end;
$$;

revoke execute on function public.bp_delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.bp_delete_account_data(uuid) to service_role;
