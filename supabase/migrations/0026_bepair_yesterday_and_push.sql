-- Bepair 0026 — «вчера» можно дозаполнить; партнёр видит, подключены ли у вас push; заряд не теряется. Run after 0025. Idempotent.
--
-- 1. A missed day is no longer lost at midnight: your own mood and note can be
--    added or changed for today and for yesterday (in your zone). Older days
--    stay closed. The reciprocity gate is unchanged: filling yesterday opens
--    the partner's yesterday, exactly as filling it on the day would have.
--
-- 2. bp_partner_push_devices(): how many devices the partner receives push on
--    (a count, never the tokens). The notification settings warn when it is 0:
--    «весточки до неё не доходят — пусть включит уведомления».
--
-- 3. The phone's charge is no longer wiped by a point that came without one
--    (the open app on a phone whose WebView keeps the charge to itself, an
--    older APK): the last known charge stays for 30 minutes.

drop policy if exists "day_entries writable by author" on public.day_entries;
create policy "day_entries writable by author"
  on public.day_entries for insert
  with check (
    user_id = auth.uid()
    and space_id = public.bp_my_space()
    and (
      entry_date between public.bp_today() - 1 and public.bp_today()
      or (public.bp_tz() is null and entry_date between current_date - 1 and current_date + 1)
    )
  );

drop policy if exists "day_entries editable same day" on public.day_entries;
drop policy if exists "day_entries editable today and yesterday" on public.day_entries;
create policy "day_entries editable today and yesterday"
  on public.day_entries for update
  using (
    user_id = auth.uid()
    and (
      entry_date between public.bp_today() - 1 and public.bp_today()
      or (public.bp_tz() is null and entry_date between current_date - 1 and current_date + 1)
    )
  )
  with check (user_id = auth.uid());

create or replace function public.bp_partner_push_devices()
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer
  from public.push_subscriptions s
  where s.user_id = public.bp_other_member(public.bp_my_space(), auth.uid())
$$;

revoke execute on function public.bp_partner_push_devices() from public, anon;
grant execute on function public.bp_partner_push_devices() to authenticated;

-- 3. bp_save_push_subscription(): store this device for whoever is signed in on
--    it now. A plain upsert cannot move a token that is still filed under the
--    partner (they once signed in on this phone): RLS hides their row and the
--    save fails, so this phone kept receiving the partner's notices and none of
--    its owner's. Holding the token is proof of holding the device.
create or replace function public.bp_save_push_subscription(p_endpoint text, p_kind text, p_p256dh text default '', p_auth text default '')
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_kind not in ('web', 'fcm', 'apns') or length(coalesce(p_endpoint, '')) not between 10 and 2000 then
    raise exception 'bad subscription';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, kind, p256dh, auth)
  values (auth.uid(), p_endpoint, p_kind, coalesce(p_p256dh, ''), coalesce(p_auth, ''))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, kind = excluded.kind, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

revoke execute on function public.bp_save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.bp_save_push_subscription(text, text, text, text) to authenticated;

-- 3. Keep the last known charge when a point arrives without one.
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
        battery = case when excluded.battery is not null then excluded.battery
                       when public.locations.updated_at > now() - interval '30 minutes' then public.locations.battery end,
        charging = case when excluded.battery is not null then excluded.charging
                        when public.locations.updated_at > now() - interval '30 minutes' then public.locations.charging end
    where public.locations.recorded_at <= excluded.recorded_at;
  return true;
end;
$$;

revoke execute on function public.bp_put_location(uuid, double precision, double precision, real, timestamptz, smallint, boolean) from public, anon, authenticated;
