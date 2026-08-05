-- Bepair / Впаре — schema additions the redesign needs.
-- Review before running: this alters the shared production database.

-- ── Day entry: mood + note ───────────────────────────────────────────────────
-- Mood is a float 0..1 read as colour. It is deliberately not an integer scale:
-- storing 1..10 would reintroduce the comparison the product rejects.

create table if not exists public.day_entries (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  entry_date  date not null default current_date,
  mood        real not null check (mood >= 0 and mood <= 1),
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists day_entries_space_date_idx
  on public.day_entries (space_id, entry_date desc);

alter table public.day_entries enable row level security;

-- The reciprocity gate lives here, not in the UI: a partner's row for a given
-- date is not readable until the viewer has recorded their own for that date.
-- Enforcing it client-side only would mean the content was already sent.
drop policy if exists "day_entries readable within space" on public.day_entries;
create policy "day_entries readable within space"
  on public.day_entries for select
  using (
    user_id = auth.uid()
    or (
      space_id in (select space_id from public.profiles where id = auth.uid())
      and exists (
        select 1
        from public.day_entries mine
        where mine.user_id = auth.uid()
          and mine.entry_date = day_entries.entry_date
      )
    )
  );

-- Insert is bound to today and to your own space. Without the date bound a user
-- could backdate a throwaway entry for any past date and unseal the partner's
-- day for it; without the space check they could write into another couple's space.
drop policy if exists "day_entries writable by author" on public.day_entries;
create policy "day_entries writable by author"
  on public.day_entries for insert
  with check (
    user_id = auth.uid()
    and entry_date between current_date - 1 and current_date + 1
    and space_id = (select p.space_id from public.profiles p where p.id = auth.uid())
  );

-- No delete policy is defined on purpose: a recorded day is not removable.

-- Update is allowed only on the same calendar day the entry belongs to.
-- After that the day is closed: irreversibility is the product's point.
drop policy if exists "day_entries editable same day" on public.day_entries;
create policy "day_entries editable same day"
  on public.day_entries for update
  using (user_id = auth.uid() and entry_date between current_date - 1 and current_date + 1)
  with check (user_id = auth.uid() and entry_date between current_date - 1 and current_date + 1);

-- Presence without content: the calendar must be able to say "there is a day
-- here" for a partner without leaking the mood or the note, the same way a
-- letter announces its arrival without opening.

create or replace function public.day_presence_for_space(target_space uuid)
returns table (user_id uuid, entry_date date)
language sql
security definer
set search_path = public
as $$
  select d.user_id, d.entry_date
  from public.day_entries d
  where d.space_id = target_space
    and target_space in (select p.space_id from public.profiles p where p.id = auth.uid());
$$;

grant execute on function public.day_presence_for_space(uuid) to authenticated;

-- ── Letters: draft, scheduled send, reveal-after-day ─────────────────────────
-- 'draft'     visible to the author only
-- 'scheduled' cancellable until deliver_at passes — irreversibility begins at
--             delivery, not at pressing send
-- 'delivered' final

do $$ begin
  create type public.letter_status as enum ('draft', 'scheduled', 'delivered');
exception when duplicate_object then null;
end $$;

alter table public.letters
  add column if not exists status public.letter_status not null default 'delivered',
  add column if not exists deliver_at timestamptz,
  add column if not exists reveal_after_day boolean not null default true;

create index if not exists letters_delivery_idx
  on public.letters (space_id, status, deliver_at);

-- Letters must be gated in SQL for the same reason day_entries are: hiding a
-- draft or a sealed letter in the client means the text was already delivered
-- to the recipient's browser. A letter is readable by its author always, and by
-- its recipient only once it is genuinely delivered — and, when the author asked
-- for it, only after the recipient has recorded their own day.

alter table public.letters enable row level security;

drop policy if exists "letters readable by author" on public.letters;
create policy "letters readable by author"
  on public.letters for select
  using (author_id = auth.uid());

drop policy if exists "letters readable by recipient when delivered" on public.letters;
create policy "letters readable by recipient when delivered"
  on public.letters for select
  using (
    recipient_id = auth.uid()
    and (
      status = 'delivered'
      or (status = 'scheduled' and deliver_at is not null and deliver_at <= now())
    )
    and (
      reveal_after_day = false
      or exists (
        select 1
        from public.day_entries mine
        where mine.user_id = auth.uid()
          and mine.entry_date = current_date
      )
    )
  );

drop policy if exists "letters writable by author" on public.letters;
create policy "letters writable by author"
  on public.letters for insert
  with check (
    author_id = auth.uid()
    and space_id = (select p.space_id from public.profiles p where p.id = auth.uid())
  );

-- An author may edit or withdraw a letter only while it is still undelivered.
drop policy if exists "letters editable until delivered" on public.letters;
create policy "letters editable until delivered"
  on public.letters for update
  using (
    author_id = auth.uid()
    and (status = 'draft' or (status = 'scheduled' and (deliver_at is null or deliver_at > now())))
  )
  with check (author_id = auth.uid());

drop policy if exists "letters deletable while draft" on public.letters;
create policy "letters deletable while draft"
  on public.letters for delete
  using (author_id = auth.uid() and status = 'draft');

-- Arrival without content: the recipient learns a letter is waiting and when it
-- came, never what it says. Drafts are excluded entirely — they belong to the
-- author alone until sent.
create or replace function public.letter_inbox()
returns table (
  id uuid,
  author_id uuid,
  created_at timestamptz,
  sealed boolean
)
language sql
security definer
set search_path = public
as $$
  select l.id, l.author_id, l.created_at, true
  from public.letters l
  where l.recipient_id = auth.uid()
    and (
      l.status = 'delivered'
      or (l.status = 'scheduled' and l.deliver_at is not null and l.deliver_at <= now())
    )
    and l.reveal_after_day = true
    and not exists (
      select 1
      from public.day_entries mine
      where mine.user_id = auth.uid()
        and mine.entry_date = current_date
    );
$$;

grant execute on function public.letter_inbox() to authenticated;

-- ── Tasks: the middle state ──────────────────────────────────────────────────
-- done_at        the doer marked it done
-- acknowledged_at the requester has since seen it
-- The middle state means "partner hasn't seen it yet", never "under review".

alter table public.checklist_items
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references public.profiles (id);
