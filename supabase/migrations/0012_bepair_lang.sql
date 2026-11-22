-- Bepair / Впаре — the language each person reads the app in.
-- Run after 0011. Idempotent.
--
-- The app decides it on the phone (saved choice, else the phone's language)
-- and writes it here, so push notifications and widget text can be composed
-- on the server in the reader's language.

alter table public.profiles
  add column if not exists lang text not null default 'ru' check (lang in ('ru', 'en'));
