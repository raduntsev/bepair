-- Bepair / Впаре — заряд телефона партнёра рядом с его аватаром и на «Карте».
-- Run after 0018. Idempotent.
--
-- The charge travels with the «Где мы» point and obeys the same rule: you see
-- your partner's charge only while you both share. No new switch, no history —
-- the one row per person in `locations` simply gains two columns.

alter table public.locations
  add column if not exists battery smallint check (battery is null or battery between 0 and 100),
  add column if not exists charging boolean;

-- The writer gains two optional arguments. The old signatures are dropped so
-- that named calls (the app, /api/widget/location) are never ambiguous; an
-- older client that does not send a charge still matches through the defaults.
drop function if exists public.bp_set_location(double precision, double precision, real, timestamptz);
drop function if exists public.bp_put_location(uuid, double precision, double precision, real, timestamptz);

create or replace function public.bp_put_location(
  who uuid, la double precision, ln double precision, acc real, at timestamptz,
  batt smallint default null, chg boolean default null
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
  at := least(coalesce(at, now()), now());
  if batt is not null and (batt < 0 or batt > 100) then
    batt := null;
  end if;

  insert into public.locations (user_id, space_id, lat, lng, accuracy, recorded_at, updated_at, battery, charging)
  values (me.id, me.space_id, la, ln, acc, at, now(), batt, chg)
  on conflict (user_id) do update
    set space_id = excluded.space_id,
        lat = excluded.lat,
        lng = excluded.lng,
        accuracy = excluded.accuracy,
        recorded_at = excluded.recorded_at,
        updated_at = now(),
        battery = excluded.battery,
        charging = excluded.charging
    where public.locations.recorded_at <= excluded.recorded_at;
  return true;
end;
$$;

revoke execute on function public.bp_put_location(uuid, double precision, double precision, real, timestamptz, smallint, boolean) from public, anon, authenticated;

create or replace function public.bp_set_location(
  la double precision, ln double precision, acc real default null, at timestamptz default null,
  batt smallint default null, chg boolean default null
)
returns boolean
language sql security definer set search_path = public
as $$ select public.bp_put_location(auth.uid(), la, ln, acc, at, batt, chg) $$;

grant execute on function public.bp_set_location(double precision, double precision, real, timestamptz, smallint, boolean) to authenticated;

-- The state now carries the charge with each point.
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
      'lat', mine.lat, 'lng', mine.lng, 'accuracy', mine.accuracy, 'recorded_at', mine.recorded_at,
      'battery', mine.battery, 'charging', mine.charging) end,
    'partner', case when theirs.user_id is null then null else jsonb_build_object(
      'lat', theirs.lat, 'lng', theirs.lng, 'accuracy', theirs.accuracy, 'recorded_at', theirs.recorded_at,
      'battery', theirs.battery, 'charging', theirs.charging) end
  );
end;
$$;

grant execute on function public.bp_location_state() to authenticated;
