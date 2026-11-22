-- Bepair / Впаре — letters could not be sent.
-- Run after 0008. Idempotent.
--
-- `letters.type` is left over from the first version of the app: NOT NULL with
-- no default. The current app keeps attachments in `media` and never sends
-- `type`, so every insert failed. A default makes the old column harmless.

alter table public.letters alter column type set default 'text';
