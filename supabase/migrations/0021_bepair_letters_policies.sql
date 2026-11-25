-- Bepair 0021 — letters keep their own rules.
--
-- 0001 wrote the rules for letters (author reads their own; the recipient reads
-- only what was delivered, and a «reveal after the day» letter only once they
-- marked their day; drafts and scheduled letters stay with the author), but the
-- old Lumina policies were never removed. Policies add up, so these let the
-- partner read every letter of the space — drafts, scheduled ones before their
-- time, sealed ones before their day — and update any of them:
--
--   «letters: space members can view»    select, space_id = my space
--   «letters: space members can update»  update, space_id = my space
--   «letters: sender can delete»         the author deletes even a delivered
--                                        letter, past the paired setting
--   «letters: sender can insert»         a duplicate of «writable by author»
--
-- The app needs none of them: the recipient marks a letter read through
-- bp_mark_letter_read, and a sealed letter's arrival comes from letter_inbox.
--
-- Also: a letter can only be addressed to your partner. Until now the
-- database took any recipient_id, so a letter could be dropped into a
-- stranger's inbox.
--
-- Safe to run more than once.

drop policy if exists "letters: space members can view" on public.letters;
drop policy if exists "letters: space members can update" on public.letters;
drop policy if exists "letters: sender can delete" on public.letters;
drop policy if exists "letters: sender can insert" on public.letters;

drop policy if exists "letters writable by author" on public.letters;
create policy "letters writable by author"
  on public.letters for insert
  with check (
    author_id = auth.uid()
    and space_id = public.bp_my_space()
    and recipient_id = public.bp_partner_id()
  );

drop policy if exists "letters editable until delivered" on public.letters;
create policy "letters editable until delivered"
  on public.letters for update
  using (
    author_id = auth.uid()
    and (status = 'draft' or (status = 'scheduled' and (deliver_at is null or deliver_at > now())))
  )
  with check (
    author_id = auth.uid()
    and space_id = public.bp_my_space()
    and recipient_id = public.bp_partner_id()
  );
