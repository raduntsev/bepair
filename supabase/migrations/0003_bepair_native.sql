-- Bepair / Впаре — native app: home-screen widgets and native push.
-- Run after 0002. Idempotent.
--
-- A widget cannot hold a Supabase session: it runs in a separate process,
-- wakes on the system's schedule and must not refresh tokens. It gets its own
-- long-lived, read-only key instead. Only a SHA-256 hash is stored; the key
-- itself lives on the device (App Group on iOS, private prefs on Android) and
-- can be revoked from settings.

create table if not exists public.widget_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  token_hash    text not null unique,
  platform      text not null default 'unknown' check (platform in ('ios', 'android', 'unknown')),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists widget_tokens_user_idx on public.widget_tokens (user_id);

alter table public.widget_tokens enable row level security;

-- Readable so settings can show «подключено на 2 устройствах»; written only below.
drop policy if exists "widget_tokens readable by owner" on public.widget_tokens;
create policy "widget_tokens readable by owner"
  on public.widget_tokens for select
  using (user_id = auth.uid());

drop policy if exists "widget_tokens revocable by owner" on public.widget_tokens;
create policy "widget_tokens revocable by owner"
  on public.widget_tokens for delete
  using (user_id = auth.uid());

-- Two random UUIDs give 244 bits; no pgcrypto needed. The plain key is
-- returned exactly once, to the device asking for it.
create or replace function public.bp_issue_widget_token(device text default 'unknown')
returns text
language plpgsql security definer set search_path = public
as $$
declare
  plain text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.widget_tokens (user_id, token_hash, platform)
  values (
    auth.uid(),
    encode(sha256(convert_to(plain, 'UTF8')), 'hex'),
    case when device in ('ios', 'android') then device else 'unknown' end
  );
  return plain;
end;
$$;

grant execute on function public.bp_issue_widget_token(text) to authenticated;

-- Hide colours on the widget: a phone on the table is seen by whoever sits nearby.
alter table public.profiles
  add column if not exists widget_hide_colors boolean not null default false;

-- Native push tokens share the table with web push. `kind` says which sender to use.
alter table public.push_subscriptions
  add column if not exists kind text not null default 'web' check (kind in ('web', 'fcm', 'apns'));

alter table public.push_subscriptions alter column p256dh set default '';
alter table public.push_subscriptions alter column auth set default '';
