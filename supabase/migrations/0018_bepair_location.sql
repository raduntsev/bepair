-- Bepair / Впаре — «Где мы»: each other on a map, and on the «Карта» widget.
-- Run after 0017. Idempotent.
--
-- The rule is the same as «сначала свой день», and it lives here, not in the
-- interface: you see your partner's point only while you share your own. Each
-- person switches sharing on for themselves; the partner's point appears once
-- both are on, and disappears for both the moment either switches off.
--
-- Only the latest point is kept — one row per person, overwritten, never a
-- track. Switching off deletes it; so does leaving the space.

alter table public.profiles
  add column if not exists share_location boolean not null default false;

create table if not exists public.locations (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  space_id     uuid not null references public.spaces (id) on delete cascade,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  accuracy     real check (accuracy is null or accuracy >= 0),
  recorded_at  timestamptz not null,
  updated_at   timestamptz not null default now()
);

create index if not exists locations_space_idx on public.locations (space_id);

alter table public.locations enable row level security;

-- Both members of the space share: the only state in which anyone sees the other.
create or replace function public.bp_location_mutual(sp uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select count(*) = 2 and bool_and(share_location)
  from public.profiles
  where space_id = sp
$$;

-- Your own point always; the partner's only while both share. Realtime obeys
-- this too, so a change of the partner's point reaches you only under the rule.
drop policy if exists "locations readable under the rule" on public.locations;
create policy "locations readable under the rule"
  on public.locations for select
  using (
    user_id = auth.uid()
    or (space_id = public.bp_my_space() and public.bp_location_mutual(space_id))
  );

-- No insert/update/delete policies: points are written by bp_set_location only.

-- Switching off, or leaving the space, takes the point away at once. A new
-- space starts with sharing off: consent was given to one partner, not to any.
create or replace function public.bp_location_cleanup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.space_id is distinct from old.space_id then
    new.share_location := false;
  end if;
  if not new.share_location then
    delete from public.locations where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists bp_location_cleanup on public.profiles;
create trigger bp_location_cleanup
  before update of share_location, space_id on public.profiles
  for each row execute function public.bp_location_cleanup();

-- The partner hears once that you started sharing — the fact, never the place.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'ping', 'day', 'task_new', 'task_done', 'task_seen', 'letter',
  'service', 'paired_proposal', 'paired_answer', 'joined',
  'remind_morning', 'remind_evening',
  'course_step', 'course_shared', 'remind_course',
  'location_shared'));

create or replace function public.bp_location_state()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  me public.profiles;
  partner public.profiles;
  mutual boolean;
  mine public.locations;
  theirs public.locations;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'not signed in';
  end if;
  if me.space_id is not null then
    select * into partner from public.profiles where space_id = me.space_id and id <> me.id limit 1;
  end if;

  mutual := me.share_location and coalesce(partner.share_location, false);
  select * into mine from public.locations where user_id = me.id;
  if mutual then
    select * into theirs from public.locations where user_id = partner.id;
  end if;

  return jsonb_build_object(
    'sharing', me.share_location,
    'partner_sharing', coalesce(partner.share_location, false),
    'has_partner', partner.id is not null,
    'me', case when mine.user_id is null then null else jsonb_build_object(
      'lat', mine.lat, 'lng', mine.lng, 'accuracy', mine.accuracy, 'recorded_at', mine.recorded_at) end,
    'partner', case when theirs.user_id is null then null else jsonb_build_object(
      'lat', theirs.lat, 'lng', theirs.lng, 'accuracy', theirs.accuracy, 'recorded_at', theirs.recorded_at) end
  );
end;
$$;

grant execute on function public.bp_location_state() to authenticated;

create or replace function public.bp_set_location_sharing(enabled boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'not signed in';
  end if;
  if enabled and me.space_id is null then
    raise exception 'no space';
  end if;

  update public.profiles set share_location = enabled where id = me.id;

  if enabled and not me.share_location then
    perform public.bp_notify(
      public.bp_other_member(me.space_id, me.id), me.id, me.space_id, 'location_shared', null, '{}'::jsonb);
  end if;

  return public.bp_location_state();
end;
$$;

grant execute on function public.bp_set_location_sharing(boolean) to authenticated;

-- The one writer of points, for the app (here) and the widget key (the
-- service role, through /api/widget/location). False when not sharing:
-- a point sent after switching off is dropped, not stored.
create or replace function public.bp_put_location(
  who uuid, la double precision, ln double precision, acc real, at timestamptz
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = who;
  if me.id is null or not me.share_location or me.space_id is null then
    return false;
  end if;
  -- A phone's clock can be off; never accept a point from the future.
  at := least(coalesce(at, now()), now());

  insert into public.locations (user_id, space_id, lat, lng, accuracy, recorded_at, updated_at)
  values (me.id, me.space_id, la, ln, acc, at, now())
  on conflict (user_id) do update
    set space_id = excluded.space_id,
        lat = excluded.lat,
        lng = excluded.lng,
        accuracy = excluded.accuracy,
        recorded_at = excluded.recorded_at,
        updated_at = now()
    -- An older fix arriving late never replaces a newer one.
    where public.locations.recorded_at <= excluded.recorded_at;
  return true;
end;
$$;

revoke execute on function public.bp_put_location(uuid, double precision, double precision, real, timestamptz) from public, anon, authenticated;

create or replace function public.bp_set_location(
  la double precision, ln double precision, acc real default null, at timestamptz default null
)
returns boolean
language sql security definer set search_path = public
as $$ select public.bp_put_location(auth.uid(), la, ln, acc, at) $$;

grant execute on function public.bp_set_location(double precision, double precision, real, timestamptz) to authenticated;

-- The map moves without a reload.
do $$
begin
  alter publication supabase_realtime add table public.locations;
exception when others then
  null; -- already published, or realtime is not set up
end;
$$;
