'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { COURSES, lessonsOf, nextLesson } from '@/lib/courses';
import { displayName } from '@/lib/words';
import { useCourses } from '@/hooks/useCourses';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Alert, Chip, Loading, Page } from '@/components/ui/Blocks';
import { COURSE_TABS, TabbedHeader } from '@/components/TabbedHeader';
import { PairProgress } from '@/components/courses/Progress';
import { CoursesUnavailable } from '@/components/courses/Unavailable';
import { isEnglish, tr } from '@/lib/i18n';

/*
  «Курсы»: every course as one card — what it is, where each of you is in it,
  and the next step one tap away. The partner's bar is always there: progress
  is shared, answers are not.
*/
export default function CoursesPage() {
  const store = useCourses();
  const { partner } = useSpaceAuth();
  const partnerName = displayName(partner?.display_name);

  return (
    <Page>
      <TabbedHeader id="courses" title={tr('Курсы', 'Courses')} tabs={COURSE_TABS} current="/courses" />

      {!store.available ? (
        <CoursesUnavailable />
      ) : store.isLoading ? (
        <Loading label={tr('Загружаем курсы…', 'Loading courses…')} />
      ) : (
        <div className="space-y-3">
          {store.error && <Alert>{store.error}</Alert>}
          {COURSES.map((course) => {
            const mine = store.doneOf(store.me, course.id);
            const theirs = partner ? store.doneOf(store.partnerId, course.id) : null;
            const next = nextLesson(course, mine);
            const started = !!store.enrolmentOf(store.me, course.id) || mine.size > 0;
            const href = started && next ? `/courses/lesson?c=${course.id}&l=${next.id}` : `/courses/course?id=${course.id}`;
            return (
              <article key={course.id} className={`rounded-2xl bg-surface shadow-card ${started && next ? 'focus-ring' : ''}`}>
                <Link href={`/courses/course?id=${course.id}`} className="block rounded-t-2xl p-5 pb-4 transition-colors hover:bg-sunken/50">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-title-3 font-semibold">{course.title}</h2>
                    <ChevronRight className="mt-0.5 size-5 shrink-0 text-line-strong" aria-hidden />
                  </div>
                  <p className="measure mt-1.5 text-subhead text-ink-faint">{course.about}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip>
                      {course.modules.filter((m) => m.id !== 'final').length} {tr('модулей', 'modules')} · {lessonsOf(course).length} {tr('шагов', 'steps')}
                    </Chip>
                    {isEnglish() && course.lang === 'ru' && <Chip>In Russian</Chip>}
                  </div>
                </Link>
                <div className="border-t border-line px-5 py-4">
                  <PairProgress
                    course={course}
                    mine={mine}
                    theirs={theirs}
                    partnerName={partnerName}
                    partnerGender={partner?.gender}
                    partnerStarted={!!store.enrolmentOf(store.partnerId, course.id)}
                  />
                </div>
                {next && (
                  <Link
                    href={href}
                    className="flex min-h-13 items-center gap-3 rounded-b-2xl border-t border-line px-5 py-3 text-body font-semibold text-accent transition-colors hover:bg-sunken/50"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {started ? `${tr('Продолжить', 'Continue')}: ${next.code} ${next.title}` : tr('Начать курс', 'Start the course')}
                    </span>
                    <ChevronRight className="size-5 shrink-0" aria-hidden />
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Page>
  );
}
