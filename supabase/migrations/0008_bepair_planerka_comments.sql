-- Bepair / Впаре — «Планёрка»: a comment for each score of the wheel.
-- Run after 0007. Idempotent.
--
-- A number alone does not say why. `comments` holds one short explanation per
-- sphere, keyed like `scores` ({"career": "сдали проект", ...}).

alter table public.planerka_wheels
  add column if not exists comments jsonb not null default '{}'::jsonb;
