'use client';

import { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BellRing, BookOpen, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { courseById, lessonsOf, nextLesson } from '@/lib/courses';
import { fmt } from '@/lib/dates';
import { displayName, verb } from '@/lib/words';
import { WEEKDAYS_SHORT } from '@/lib/planerka';
import { useCourses } from '@/hooks/useCourses';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Alert, Card, EmptyState, Loading, Page, PageHeader, RowIcon, SectionHeader } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/Avatar';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { Sheet } from '@/components/ui/Sheet';
import { PairProgress, StepDot, stepState } from '@/components/courses/Progress';
import { CourseReminder, ShareSwitch } from '@/components/courses/CourseSettings';
import { CoursesUnavailable } from '@/components/courses/Unavailable';
import { tr } from '@/lib/i18n';

export default function CoursePage() {
  return (
    <Suspense fallback={<Loading label={tr('Загружаем курс…', 'Loading the course…')} />}>
      <CourseView />
    </Suspense>
  );
}

/*
  One course: where the two of you are, the two personal settings that matter
  here (who sees my answers, when to remind me), and the path — module by
  module, each lesson done, current, or still closed. The partner's place on
  the path is their amber circle beside the lesson they are on.
*/
function CourseView() {
  const params = useSearchParams();
  const router = useRouter();
  const course = courseById(params.get('id'));
  const store = useCourses();
  const { partner } = useSpaceAuth();
  const partnerName = displayName(partner?.display_name);
  const [guideOpen, setGuideOpen] = useState<boolean | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const closeReminder = useCallback(() => setReminderOpen(false), [setReminderOpen]);
  const [starting, setStarting] = useState(false);

  if (!course) {
    return (
      <Page>
        <PageHeader title={tr('Курс', 'Course')} back={{ href: '/courses', label: tr('Курсы', 'Courses') }} />
        <EmptyState title={tr('Такого курса нет', 'No such course')} />
      </Page>
    );
  }

  const mine = store.doneOf(store.me, course.id);
  const theirs = partner ? store.doneOf(store.partnerId, course.id) : null;
  const next = nextLesson(course, mine);
  const theirNext = theirs ? nextLesson(course, theirs) : null;
  const started = !!store.enrolmentOf(store.me, course.id) || mine.size > 0;
  const partnerStarted = !!store.enrolmentOf(store.partnerId, course.id) || (theirs?.size ?? 0) > 0;
  const showGuide = guideOpen ?? !started;
  const prefs = store.myPrefs;

  const begin = async () => {
    setStarting(true);
    const ok = await store.start(course.id);
    setStarting(false);
    const first = lessonsOf(course)[0];
    if (ok && first) router.push(`/courses/lesson?c=${course.id}&l=${first.id}`);
  };

  return (
    <Page>
      <PageHeader title={course.title} back={{ href: '/courses', label: tr('Курсы', 'Courses') }} />

      {!store.available ? (
        <CoursesUnavailable />
      ) : store.isLoading ? (
        <Loading label={tr('Загружаем курс…', 'Loading the course…')} />
      ) : (
        <div className="space-y-3">
          {store.error && <Alert>{store.error}</Alert>}

          <Card>
            <p className="measure text-body text-ink-soft">{course.about}</p>
            <div className="mt-4">
              <PairProgress course={course} mine={mine} theirs={theirs} partnerName={partnerName} partnerGender={partner?.gender} partnerStarted={partnerStarted} />
            </div>
            {!started ? (
              <Button size="lg" block className="mt-5" loading={starting} onClick={begin}>
                {tr('Начать курс', 'Start the course')}
              </Button>
            ) : next ? (
              <Link
                href={`/courses/lesson?c=${course.id}&l=${next.id}`}
                className="mt-5 flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-[0.875rem] bg-accent px-6 text-headline font-semibold text-accent-ink transition-opacity active:opacity-70"
              >
                <span className="truncate">
                  {tr('Продолжить', 'Continue')}: {next.code}
                </span>
              </Link>
            ) : null}
          </Card>

          {/* How to work with it: open before you start, folded afterwards. */}
          <section className="rounded-2xl bg-surface shadow-card">
            <button
              type="button"
              aria-expanded={showGuide}
              onClick={() => setGuideOpen(!showGuide)}
              className="flex min-h-13 w-full items-center gap-3.5 rounded-2xl px-4 py-2.5 text-left transition-colors hover:bg-sunken/50"
            >
              <RowIcon Icon={BookOpen} />
              <span className="min-w-0 flex-1 text-body text-ink">{tr('Как заниматься', 'How to work with it')}</span>
              <ChevronDown className={`size-5 shrink-0 text-line-strong transition-transform duration-300 ${showGuide ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            <AutoHeight>
              {showGuide && (
                <ol className="space-y-3 px-5 pt-1 pb-5">
                  {course.guidance.map((g, i) => (
                    <li key={i} className="flex gap-3">
                      <span aria-hidden className="w-5 shrink-0 text-subhead font-semibold text-accent tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="measure text-subhead text-ink-soft">{g}</span>
                    </li>
                  ))}
                </ol>
              )}
            </AutoHeight>
          </section>

          {partner && <ShareSwitch store={store} partnerName={partnerName} />}

          <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line">
            {partner && (
              <li>
                <Link
                  href="/journal?who=partner"
                  className="flex min-h-13 items-center gap-3.5 px-4 py-2.5 transition-colors hover:bg-sunken"
                >
                  <RowIcon Icon={store.partnerShares ? Eye : EyeOff} tone={store.partnerShares ? 'partner' : 'neutral'} />
                  <span className="min-w-0 flex-1 text-body text-ink">
                    {store.partnerShares
                      ? tr(`${partnerName} ${verb(partner?.gender, 'открыл')} вам свои ответы`, `${partnerName} shares their answers with you`)
                      : tr(`Ответы: ${partnerName} — скрыты`, `${partnerName}’s answers are hidden`)}
                  </span>
                  {store.partnerShares && <ChevronRight className="size-5 shrink-0 text-line-strong" aria-hidden />}
                </Link>
              </li>
            )}
            <li>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setReminderOpen(true)}
                className="flex min-h-13 w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors hover:bg-sunken"
              >
                <RowIcon Icon={BellRing} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-ink">{tr('Напоминание', 'Reminder')}</span>
                  {prefs?.remind && prefs.remind_days.length < 7 && (
                    <span className="block truncate text-footnote text-ink-faint">
                      {[1, 2, 3, 4, 5, 6, 0].filter((d) => prefs.remind_days.includes(d)).map((d) => WEEKDAYS_SHORT[d]).join(' ') || tr('дни не выбраны', 'no days chosen')}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-body text-ink-faint tabular-nums">
                  {prefs?.remind ? (prefs.remind_days.length === 7 ? tr(`каждый день, ${prefs.remind_at}`, `daily, ${prefs.remind_at}`) : prefs.remind_at) : tr('выкл.', 'off')}
                </span>
                <ChevronRight className="size-5 shrink-0 text-line-strong" aria-hidden />
              </button>
            </li>
          </ul>

          {course.modules.map((module) => (
            <section key={module.id} aria-labelledby={`mod-${module.id}`}>
              <SectionHeader title={module.id === 'final' ? module.title : `${module.n}. ${module.title}`} />
              <p id={`mod-${module.id}`} className="measure -mt-1 mb-2.5 px-1 text-subhead text-ink-faint">
                {module.about}
              </p>
              <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:relative [&>li+li]:before:absolute [&>li+li]:before:inset-x-0 [&>li+li]:before:top-0 [&>li+li]:before:ml-[3.75rem] [&>li+li]:before:h-px [&>li+li]:before:bg-line">
                {module.lessons.map((lesson) => {
                  const state = started ? stepState(course, lesson.id, mine) : lesson === lessonsOf(course)[0] ? 'current' : 'locked';
                  const partnerHere = !!partner && partnerStarted && theirNext?.id === lesson.id;
                  const body = (
                    <>
                      <StepDot state={state} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-body ${state === 'locked' ? 'text-ink-faint' : 'text-ink'}`}>
                          <span className="tabular-nums text-ink-faint">{lesson.code}</span> {lesson.title}
                        </span>
                        {lesson.kind !== 'lesson' && (
                          <span className="block text-footnote text-ink-faint">
                            {lesson.kind === 'final' ? tr('итоговая работа', 'final reflection') : tr('практическая работа', 'practice')}
                          </span>
                        )}
                      </span>
                      {partnerHere && (
                        <span className="flex shrink-0 items-center gap-1.5" title={tr(`${partnerName} здесь`, `${partnerName} is here`)}>
                          <Avatar path={partner?.avatar_url} name={partnerName} who="partner" className="size-6 text-caption" />
                          <span className="sr-only">{tr(`${partnerName} сейчас на этом шаге`, `${partnerName} is on this step`)}</span>
                        </span>
                      )}
                      {state !== 'locked' && <ChevronRight className="size-5 shrink-0 text-line-strong" aria-hidden />}
                    </>
                  );
                  return (
                    <li key={lesson.id}>
                      {state === 'locked' ? (
                        <div className="flex min-h-13 items-center gap-3.5 px-4 py-2.5" aria-disabled="true">
                          {body}
                        </div>
                      ) : (
                        <Link
                          href={`/courses/lesson?c=${course.id}&l=${lesson.id}`}
                          className={`flex min-h-13 items-center gap-3.5 px-4 py-2.5 transition-colors hover:bg-sunken ${state === 'current' && started ? 'bg-accent-soft/40' : ''}`}
                        >
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {course.books && (
            <section>
              <SectionHeader title={tr('Книги о самопознании', 'Further reading')} />
              <Card>
                <ul className="space-y-1.5 text-subhead text-ink-soft">
                  {course.books.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {started && !next && (
            <p className="px-1 pt-2 text-subhead text-ink-faint">
              {tr('Курс пройден', 'Course finished')}
              {store.enrolmentOf(store.me, course.id)?.finished_at ? ` · ${fmt(store.enrolmentOf(store.me, course.id)!.finished_at!, 'd MMMM yyyy')}` : ''}
            </p>
          )}
        </div>
      )}

      <Sheet open={reminderOpen} onClose={closeReminder} title={tr('Напоминание о курсе', 'Course reminder')}>
        <CourseReminder store={store} partnerName={partner ? partnerName : undefined} />
      </Sheet>
    </Page>
  );
}
