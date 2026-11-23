import { EmptyState } from '@/components/ui/Blocks';

/* Shown only until migration 0015 is run — a developer notice, so it stays Russian like the others. */
export function CoursesUnavailable() {
  return (
    <EmptyState title="Курсы ещё не подключены">
      Выполните в Supabase миграцию supabase/migrations/0015_bepair_courses.sql — после этого здесь появятся курсы и журнал.
    </EmptyState>
  );
}
