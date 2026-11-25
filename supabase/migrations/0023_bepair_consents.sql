-- Bepair 0023 — consents, given and withdrawn on the record.
--
-- Since 1 September 2025 (156-ФЗ, ч. 1 ст. 9 152-ФЗ) consent to personal data
-- processing is a document of its own, given separately. Health data — the
-- cycle marks — is a special category (ст. 10) and needs its own consent.
--
--   profiles.consent_version / consent_at  — the current general consent
--   profiles.health_consent_at             — the consent for cycle data
--   bp_consent_log                          — every giving and withdrawing
--
-- Both are written only by the functions below, so the record can be trusted:
-- a guard keeps the app from setting them directly, and from turning cycle
-- tracking on without the health consent.
--
-- Withdrawing the health consent stops tracking and deletes the cycle marks
-- (ч. 5 ст. 21: processing stops and the data is destroyed). Withdrawing the
-- general consent is deleting the account (/api/account/delete).
--
-- Safe to run more than once.

alter table public.profiles add column if not exists consent_version   text;
alter table public.profiles add column if not exists consent_at        timestamptz;
alter table public.profiles add column if not exists health_consent_at timestamptz;

create table if not exists public.bp_consent_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('personal', 'health')),
  version    text not null,
  action     text not null check (action in ('given', 'withdrawn')),
  at         timestamptz not null default now(),
  user_agent text
);
create index if not exists bp_consent_log_user on public.bp_consent_log (user_id, at desc);

alter table public.bp_consent_log enable row level security;
drop policy if exists "consent log readable by its person" on public.bp_consent_log;
create policy "consent log readable by its person" on public.bp_consent_log
  for select using (user_id = auth.uid());
-- No insert/update/delete policies: only the functions below write it.

create or replace function public.bp_profiles_consent_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (new.consent_version, new.consent_at, new.health_consent_at)
     is distinct from (old.consent_version, old.consent_at, old.health_consent_at) then
    raise exception 'consents change only through bp_give_consent and bp_withdraw_health_consent'
      using errcode = '42501';
  end if;
  if new.cycle_tracking and not coalesce(old.cycle_tracking, false) and new.health_consent_at is null then
    raise exception 'cycle tracking needs the health consent first' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists bp_profiles_consent_guard on public.profiles;
create trigger bp_profiles_consent_guard
  before update on public.profiles
  for each row execute function public.bp_profiles_consent_guard();

-- kind: 'personal' (with the document's version) or 'health'.
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
  if kind not in ('personal', 'health') or coalesce(trim(version), '') = '' then
    raise exception 'unknown consent' using errcode = '22023';
  end if;

  if kind = 'personal' then
    update public.profiles set consent_version = version, consent_at = now() where id = me;
  else
    update public.profiles set health_consent_at = now() where id = me;
  end if;
  insert into public.bp_consent_log (user_id, kind, version, action, user_agent)
  values (me, kind, version, 'given', left(agent, 500));
end;
$$;

create or replace function public.bp_withdraw_health_consent(version text default '', agent text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.profiles set health_consent_at = null, cycle_tracking = false where id = me;
  delete from public.cycle_days where user_id = me;
  insert into public.bp_consent_log (user_id, kind, version, action, user_agent)
  values (me, 'health', coalesce(nullif(version, ''), '-'), 'withdrawn', left(agent, 500));
end;
$$;

grant execute on function public.bp_give_consent(text, text, text) to authenticated;
grant execute on function public.bp_withdraw_health_consent(text, text) to authenticated;
revoke execute on function public.bp_give_consent(text, text, text) from anon;
revoke execute on function public.bp_withdraw_health_consent(text, text) from anon;
