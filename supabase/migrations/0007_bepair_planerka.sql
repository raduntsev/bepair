-- Bepair / Впаре — «Планёрка»: the couple's weekly sit-down.
-- Run after 0003. Idempotent.
--
-- A planerka is one dated session. Each partner has their own wheel of balance
-- and their own answers inside it; either partner may write the other's fields
-- (one dictates, the other types), so every row keeps who it belongs to
-- (user_id) apart from who entered it (entered_by). Everything here is shared
-- by the couple and visible to both at once — it is done together, so the
-- «сначала свой день» rule does not apply.

-- When the couple usually meets. One row per space; either partner may change it.
create table if not exists public.planerka_settings (
  space_id   uuid primary key references public.spaces (id) on delete cascade,
  weekday    smallint not null default 0 check (weekday between 0 and 6), -- 0 = Sunday, as in JS Date
  at_time    time not null default '13:00',
  updated_at timestamptz not null default now()
);

create table if not exists public.planerkas (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  held_on     date not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (space_id, held_on)
);

create table if not exists public.planerka_wheels (
  id           uuid primary key default gen_random_uuid(),
  planerka_id  uuid not null references public.planerkas (id) on delete cascade,
  space_id     uuid not null references public.spaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  scores       jsonb not null default '{}'::jsonb,
  note         text not null default '',
  entered_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (planerka_id, user_id)
);

create table if not exists public.planerka_answers (
  id           uuid primary key default gen_random_uuid(),
  planerka_id  uuid not null references public.planerkas (id) on delete cascade,
  space_id     uuid not null references public.spaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  question     text not null,
  answer       text not null default '',
  entered_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (planerka_id, user_id, question)
);

-- Household to-dos: whose (a partner, or null for «общее»), status, and the decision taken.
create table if not exists public.plan_todos (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces (id) on delete cascade,
  owner_id     uuid references public.profiles (id) on delete set null,
  content      text not null check (length(trim(content)) between 1 and 500),
  status       text not null default 'todo' check (status in ('todo', 'in_process', 'done')),
  decision     text not null default '',
  planerka_id  uuid references public.planerkas (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);

create index if not exists planerkas_space_idx on public.planerkas (space_id, held_on desc);
create index if not exists planerka_wheels_space_idx on public.planerka_wheels (space_id, user_id);
create index if not exists planerka_answers_space_idx on public.planerka_answers (space_id, question);
create index if not exists plan_todos_space_idx on public.plan_todos (space_id, status);

-- One policy set for every table: readable and writable within your own space.
do $$
declare
  t text;
begin
  foreach t in array array['planerka_settings', 'planerkas', 'planerka_wheels', 'planerka_answers', 'plan_todos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s within space" on public.%I', t, t);
    execute format(
      'create policy "%s within space" on public.%I for all using (space_id = public.bp_my_space()) with check (space_id = public.bp_my_space())',
      t, t
    );
  end loop;
end;
$$;

-- Live editing during the call: both phones see each other's typing.
do $$
begin
  alter publication supabase_realtime add table public.planerka_wheels;
exception when others then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.planerka_answers;
exception when others then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.plan_todos;
exception when others then null;
end;
$$;
