-- Bepair 0025 — «Бюджет» в планёрке. Run after 0024. Idempotent.
--
-- The couple's own budget table, moved into the app: each partner's income and
-- expenses by category, month by month, and savings goals — personal or shared —
-- with a share of income set aside for each (plan) and what was actually put
-- away (fact). Everything is visible to both, as in their spreadsheet.
--
-- Like the rest of the planerka, either partner may enter the other's numbers
-- (one dictates, the other types): user_id is whose money it is, entered_by is
-- who typed it. Expenses are logged during the month; the check-in reads the
-- month's totals.

create table if not exists public.budget_entries (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('expense', 'income')),
  amount      numeric(12, 2) not null check (amount > 0 and amount < 100000000),
  category    text not null default '' check (length(category) <= 60),
  note        text not null default '' check (length(note) <= 300),
  spent_on    date not null default current_date,
  entered_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists budget_entries_month on public.budget_entries (space_id, spent_on);

-- owner_id null = a shared goal («Недвижимость»), funded by both.
-- percent = the share of the owner's monthly income meant for it; for a shared
-- goal, the share of each partner's income.
create table if not exists public.budget_goals (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  owner_id    uuid references public.profiles (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 80),
  target      numeric(14, 2) check (target is null or target > 0),
  percent     numeric(5, 2) not null default 0 check (percent >= 0 and percent <= 100),
  archived_at timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists budget_goals_space on public.budget_goals (space_id);

-- What was actually put away towards a goal, by whom, in which month.
create table if not exists public.budget_savings (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  goal_id     uuid not null references public.budget_goals (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount <> 0 and abs(amount) < 100000000),
  month       date not null check (extract(day from month) = 1),
  entered_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists budget_savings_space on public.budget_savings (space_id, month);

alter table public.budget_entries enable row level security;
alter table public.budget_goals enable row level security;
alter table public.budget_savings enable row level security;

-- Within your own space; the money belongs to one of the two of you.
drop policy if exists "budget entries within space" on public.budget_entries;
create policy "budget entries within space" on public.budget_entries
  for all to authenticated
  using (space_id = public.bp_my_space())
  with check (
    space_id = public.bp_my_space()
    and (user_id = auth.uid() or user_id = public.bp_partner_id())
    and entered_by = auth.uid()
  );

drop policy if exists "budget goals within space" on public.budget_goals;
create policy "budget goals within space" on public.budget_goals
  for all to authenticated
  using (space_id = public.bp_my_space())
  with check (
    space_id = public.bp_my_space()
    and (owner_id is null or owner_id = auth.uid() or owner_id = public.bp_partner_id())
  );

drop policy if exists "budget savings within space" on public.budget_savings;
create policy "budget savings within space" on public.budget_savings
  for all to authenticated
  using (space_id = public.bp_my_space())
  with check (
    space_id = public.bp_my_space()
    and (user_id = auth.uid() or user_id = public.bp_partner_id())
    and entered_by = auth.uid()
    and exists (select 1 from public.budget_goals g where g.id = goal_id and g.space_id = public.bp_my_space())
  );

-- Both phones see a new expense without a reload.
do $$
begin
  alter publication supabase_realtime add table public.budget_entries;
exception when others then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.budget_savings;
exception when others then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.budget_goals;
exception when others then null;
end;
$$;
