-- Bepair / Впаре — deleting all of a couple's data, by agreement of both.
-- Run after 0012. Idempotent.
--
-- One partner proposes (bp_propose_reset), the other agrees in the app, and
-- the server route /api/space/reset does the rest: it removes the couple's
-- files from storage (storage.objects refuses direct deletes, so that part
-- goes through the Storage API with the service key) and then calls
-- bp_reset_space, which unlinks both profiles and deletes the space with
-- everything in it. Both accounts survive, alone, free to start again.
-- Alone in a space there is nobody to agree: it is deleted at once.

create or replace function public.bp_propose_reset()
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
  if partner is null then
    return 'alone';
  end if;

  s := public.bp_settings();
  -- The partner already asked for exactly this: asking back is agreement.
  if s.pending_key = 'reset_space' and s.pending_by = partner then
    return 'agreed';
  end if;

  update public.space_settings
     set pending_key = 'reset_space', pending_value = true, pending_by = auth.uid(), pending_at = now()
   where space_id = sp;

  perform public.bp_notify(partner, auth.uid(), sp, 'paired_proposal', null,
    jsonb_build_object('key', 'reset_space', 'value', true));
  return 'proposed';
end;
$$;

grant execute on function public.bp_propose_reset() to authenticated;

-- Server only (the route checks the agreement first). Profiles are unlinked
-- before the space goes: profiles.space_id cascades, and the accounts must stay.
create or replace function public.bp_reset_space(sp uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
     set space_id = null,
         avatar_url = case when avatar_url like sp::text || '/%' then null else avatar_url end
   where space_id = sp;

  -- Tables that carry space_id without a foreign key to spaces.
  delete from public.letters where space_id = sp;
  delete from public.task_templates where space_id = sp;
  delete from public.shop_requests where space_id = sp;
  delete from public.shop_purchases where space_id = sp;
  delete from public.shop_items where space_id = sp;
  delete from public.daily_metrics where space_id = sp;
  delete from public.daily_pulse where space_id = sp;

  -- Everything else cascades from the space.
  delete from public.spaces where id = sp;
end;
$$;

revoke execute on function public.bp_reset_space(uuid) from public, anon, authenticated;
