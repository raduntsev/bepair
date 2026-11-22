-- Bepair / Впаре — «Планёрка»: each partner closes their own part.
-- Run after 0009. Idempotent.
--
-- The wheel row is already one per person per session, so «I am done» lives
-- there. Null — still filling in; a time — closed by then. Closing hides the
-- session from that person's «Сегодня»; reopening clears it.

alter table public.planerka_wheels
  add column if not exists closed_at timestamptz;
