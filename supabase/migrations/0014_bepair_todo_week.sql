-- Planerka to-dos are set for a week (until the next meeting). week_of moves
-- one carried over from an earlier week into the current one; null means the
-- week it was created in.
alter table public.plan_todos add column if not exists week_of date;
