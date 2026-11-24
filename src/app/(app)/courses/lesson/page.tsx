'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Lock, Users } from 'lucide-react';
import { courseById, isOpen, lessonById, lessonsOf, missingFields, nextLesson, type FieldValue, type LessonAnswers } from '@/lib/courses';
import { fmt, plural } from '@/lib/dates';
import { displayName, verb } from '@/lib/words';
import { useCourses } from '@/hooks/useCourses';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Alert, Card, EmptyState, Loading, Page, PageHeader } from '@/components/ui/Blocks';
import { Button, LinkButton } from '@/components/ui/Button';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { FieldEditor, AnswersView } from '@/components/courses/CourseFields';
import { ThoughtDiary } from '@/components/courses/ThoughtDiary';
import { CoursesUnavailable } from '@/components/courses/Unavailable';
import { TheoryCard } from '@/components/courses/Theory';
import { Celebration } from '@/components/courses/Rewards';
import { tr } from '@/lib/i18n';

const SAVE_AFTER_MS = 700;

export default function LessonPage() {
  return (
    <Suspense fallback={<Loading label={tr('Открываем урок…', 'Opening the lesson…')} />}>
      <LessonView />
    </Suspense>
  );
}

/*
  One step of a course. The questions save themselves as you type; nothing is
  required. «Шаг пройден» is the only deliberate act — it moves you on, opens
  the next lesson, and tells your partner which step you took (never what you
  wrote).
*/
function LessonView() {
  const params = useSearchParams();
  const router = useRouter();
  const course = courseById(params.get('c'));
  const lesson = course ? lessonById(course, params.get('l')) : null;
  const store = useCourses();
  const { partner } = useSpaceAuth();
  const partnerName = displayName(partner?.display_name);

  const [draft, setDraft] = useState<LessonAnswers>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [finishing, setFinishing] = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  /* Set by a tap on «Шаг пройден» with questions still open: from then on the empty ones are marked. */
  const [showMissing, setShowMissing] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<LessonAnswers | null>(null);

  const lessonKey = course && lesson ? `${course.id}/${lesson.id}` : null;

  /* Take the stored answers once per lesson, when they arrive — never over what is being typed. */
  useEffect(() => {
    if (!lessonKey || store.isLoading || loadedFor.current === lessonKey) return;
    loadedFor.current = lessonKey;
    setDraft(store.myAnswers.get(lessonKey) ?? {});
    setStatus('idle');
    setShowMissing(false);
  }, [lessonKey, store.isLoading, store.myAnswers]);

  const { saveAnswers } = store;
  const flush = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const data = pending.current;
    if (!data || !course || !lesson) return true;
    pending.current = null;
    setStatus('saving');
    const ok = await saveAnswers(course.id, lesson.id, data);
    setStatus(ok ? 'saved' : 'idle');
    return ok;
  }, [course, lesson, saveAnswers]);

  /* Leaving the lesson saves what is left. */
  useEffect(() => () => void flush(), [flush]);

  const change = (fieldId: string, value: FieldValue) => {
    const next = { ...draft, [fieldId]: value };
    setDraft(next);
    pending.current = next;
    setStatus('idle');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_AFTER_MS);
  };

  if (!course || !lesson) {
    return (
      <Page>
        <PageHeader title={tr('Урок', 'Lesson')} back={{ href: '/courses', label: tr('Курсы', 'Courses') }} />
        <EmptyState title={tr('Такого урока нет', 'No such lesson')} />
      </Page>
    );
  }

  const back = { href: `/courses/course?id=${course.id}`, label: course.title };
  const all = lessonsOf(course);
  const at = all.findIndex((l) => l.id === lesson.id);
  const prev = at > 0 ? all[at - 1] : null;
  const after = at < all.length - 1 ? all[at + 1] : null;
  const mine = store.doneOf(store.me, course.id);
  const theirs = partner ? store.doneOf(store.partnerId, course.id) : null;
  const doneAt = store.doneAt(store.me, course.id, lesson.id);
  const partnerDone = !!theirs?.has(lesson.id);
  const partnerHere = !!theirs && nextLesson(course, theirs)?.id === lesson.id && !!store.enrolmentOf(store.partnerId, course.id);
  const theirAnswers = store.partnerShares ? store.answersFor(store.partnerId, course.id, lesson.id) : null;
  const eyebrow =
    lesson.module.id === 'final'
      ? course.title
      : `${tr('Модуль', 'Module')} ${lesson.module.n} · ${lesson.kind === 'practice' ? tr('практическая работа', 'practice') : `${tr('урок', 'lesson')} ${lesson.code}`}`;

  if (store.available && !store.isLoading && !isOpen(course, lesson.id, mine)) {
    const current = nextLesson(course, mine);
    return (
      <Page>
        <PageHeader eyebrow={eyebrow} title={lesson.title} back={back} />
        <EmptyState
          title={tr('Этот шаг пока закрыт', 'This step is still closed')}
          action={current ? <LinkButton href={`/courses/lesson?c=${course.id}&l=${current.id}`}>{`${tr('К шагу', 'Go to')} ${current.code}`}</LinkButton> : undefined}
        >
          {tr('Уроки открываются по порядку.', 'Lessons open in order.')}
        </EmptyState>
      </Page>
    );
  }

  const diaryCount = store.myEntries.filter((e) => e.kind === 'thought').length;
  const missing = missingFields(lesson, draft, diaryCount);
  const missingIds = new Set(missing.map((f) => f.id));
  const required = lesson.fields.filter((f) => !f.optional).length;

  const finish = async () => {
    if (missing.length > 0) {
      setShowMissing(true);
      document.getElementById(`field-${missing[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFinishing(true);
    const saved = await flush();
    const result = saved ? await store.markDone(course.id, lesson.id) : null;
    setFinishing(false);
    if (!result) return;
    /* The reward is shown where you land: a line for a step, a sheet for a module or the course. */
    const reward = `&reward=${result.points}&course=${course.id}${result.module ? `&badge=${result.module.id}` : ''}`;
    router.push(after ? `/courses/lesson?c=${course.id}&l=${after.id}${reward}` : `/courses/course?id=${course.id}${reward}`);
  };

  return (
    <Page>
      <PageHeader eyebrow={eyebrow} title={lesson.title} back={back} />

      {store.available && !store.isLoading && <Celebration key={params.toString()} streak={store.streakOf(store.me)} />}

      {!store.available ? (
        <CoursesUnavailable />
      ) : store.isLoading ? (
        <Loading label={tr('Открываем урок…', 'Opening the lesson…')} />
      ) : (
        <div className="space-y-3">
          {lesson.intro && !lesson.theory && <p className="measure -mt-2 mb-5 px-1 text-body text-ink-soft">{lesson.intro}</p>}

          {partnerHere && !partnerDone && (
            <p className="flex items-center gap-2 px-1 text-subhead text-partner-ink">
              <span aria-hidden className="size-2 rounded-full bg-partner" /> {tr(`${partnerName} тоже на этом шаге`, `${partnerName} is on this step too`)}
            </p>
          )}

          {lesson.theory && <TheoryCard theory={lesson.theory} />}

          {lesson.theory && <h2 className="px-1 pt-5 text-title-3 font-semibold">{tr('Задание', 'Your task')}</h2>}

          {lesson.fields.map((field) => (
            <div
              key={field.id}
              id={`field-${field.id}`}
              className={`scroll-mt-6 rounded-2xl ${showMissing && missingIds.has(field.id) ? 'ring-2 ring-danger' : ''}`}
            >
            <Card>
              {field.kind === 'diary' ? (
                <div>
                  <h2 className="text-headline font-semibold">{field.q}</h2>
                  {field.hint && <p className="measure mt-1 text-subhead text-ink-faint">{field.hint}</p>}
                  <div className="mt-3">
                    <ThoughtDiary store={store} entries={store.myEntries} limit={3} />
                  </div>
                </div>
              ) : (
                <FieldEditor
                  field={field}
                  value={draft[field.id]}
                  onChange={(value) => change(field.id, value)}
                  echo={
                    field.kind === 'text'
                      ? field.echo?.map((e) => ({ label: e.label, value: store.answersFor(store.me, course.id, e.lesson)?.[e.field] }))
                      : undefined
                  }
                />
              )}
              {showMissing && missingIds.has(field.id) && (
                <p className="mt-3 text-footnote font-medium text-danger">
                  {field.kind === 'list'
                    ? tr('Заполните все строки', 'Fill in every line')
                    : field.kind === 'scale'
                      ? tr('Оцените каждую сферу', 'Rate every sphere')
                      : field.kind === 'table'
                        ? tr('Заполните хотя бы одну строку целиком', 'Fill in at least one whole row')
                        : field.kind === 'diary'
                          ? tr('Сделайте хотя бы одну запись', 'Add at least one entry')
                          : tr('Ответьте на этот вопрос', 'Answer this question')}
                </p>
              )}
            </Card>
            </div>
          ))}

          {lesson.links && (
            <ul className="space-y-1 px-1">
              {lesson.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="tap inline-flex items-center gap-1.5 text-subhead font-medium text-accent hover:opacity-80"
                  >
                    <ExternalLink className="size-4 shrink-0" aria-hidden /> {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {lesson.tip && <p className="measure px-1 text-subhead text-ink-faint">{lesson.tip}</p>}

          {lesson.together && partner && (
            <section className="rounded-2xl bg-partner-soft p-5">
              <h2 className="flex items-center gap-2 text-headline font-semibold text-partner-ink">
                <Users className="size-5" aria-hidden /> {tr('Вдвоём', 'Together')}
              </h2>
              <p className="measure mt-1.5 text-body text-ink">{lesson.together}</p>
              {(doneAt || partnerDone) && (
                <p className="mt-2 text-footnote text-ink-soft">
                  {doneAt && partnerDone
                    ? tr('Вы оба прошли этот шаг', 'You have both done this step')
                    : partnerDone
                      ? tr(`${partnerName} уже ${verb(partner?.gender, 'закончил')} этот шаг`, `${partnerName} has done this step`)
                      : tr(`${partnerName} ещё не ${verb(partner?.gender, 'добрался')} сюда`, `${partnerName} hasn’t got here yet`)}
                </p>
              )}
            </section>
          )}

          {theirAnswers && Object.keys(theirAnswers).length > 0 && (
            <section className="rounded-2xl bg-surface shadow-card">
              <button
                type="button"
                aria-expanded={showPartner}
                onClick={() => setShowPartner(!showPartner)}
                className="flex min-h-13 w-full items-center gap-3 rounded-2xl px-5 py-3 text-left transition-colors hover:bg-sunken/50"
              >
                <span aria-hidden className="size-2.5 rounded-full bg-partner" />
                <span className="min-w-0 flex-1 text-body font-semibold">{tr(`Ответы: ${partnerName}`, `${partnerName}’s answers`)}</span>
                <ChevronDown className={`size-5 text-line-strong transition-transform duration-300 ${showPartner ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              <AutoHeight>
                {showPartner && (
                  <div className="px-5 pb-5">
                    <AnswersView fields={lesson.fields} answers={theirAnswers} />
                  </div>
                )}
              </AutoHeight>
            </section>
          )}

          {store.error && <Alert>{store.error}</Alert>}

          <div className="pt-3">
            {doneAt ? (
              <div className="space-y-3">
                <p className="flex items-center justify-center gap-1.5 text-subhead text-ink-faint">
                  <Check className="size-4 text-accent" aria-hidden /> {tr('Пройдено', 'Done')} {fmt(doneAt, 'd MMMM')}
                </p>
                {after && (
                  <LinkButton href={`/courses/lesson?c=${course.id}&l=${after.id}`} size="lg" block>
                    <span className="truncate">
                      {tr('Дальше', 'Next')}: {after.code} {after.title}
                    </span>
                  </LinkButton>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {showMissing && missing.length > 0 && (
                  <Alert>
                    {tr(
                      `Осталось ответить: ${missing.length} ${plural(missing.length, 'вопрос', 'вопроса', 'вопросов')}`,
                      `${missing.length} ${missing.length === 1 ? 'question' : 'questions'} still to answer`,
                    )}
                  </Alert>
                )}
                <Button size="lg" block loading={finishing} onClick={finish}>
                  {lesson.kind === 'final' ? tr('Завершить курс', 'Finish the course') : tr('Шаг пройден', 'Step done')}
                </Button>
                <p className="text-center text-footnote text-ink-faint tabular-nums">
                  {tr('Отвечено', 'Answered')} {required - missing.length} {tr('из', 'of')} {required}
                </p>
              </div>
            )}
            <p role="status" aria-live="polite" className="mt-2 h-5 text-center text-footnote text-ink-faint">
              {status === 'saving' ? tr('Сохраняем…', 'Saving…') : status === 'saved' ? tr('Ответы сохранены', 'Answers saved') : ''}
            </p>
          </div>

          <nav aria-label={tr('Соседние шаги', 'Nearby steps')} className="flex items-center justify-between gap-3 pt-1">
            {prev ? (
              <Link href={`/courses/lesson?c=${course.id}&l=${prev.id}`} className="tap inline-flex min-w-0 items-center gap-1 text-subhead text-accent hover:opacity-80">
                <ChevronLeft className="size-5 shrink-0" aria-hidden /> <span className="truncate">{prev.code}</span>
              </Link>
            ) : (
              <span />
            )}
            {after &&
              (isOpen(course, after.id, mine) ? (
                <Link href={`/courses/lesson?c=${course.id}&l=${after.id}`} className="tap inline-flex min-w-0 items-center gap-1 text-subhead text-accent hover:opacity-80">
                  <span className="truncate">{after.code}</span> <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-subhead text-ink-faint">
                  <Lock className="size-3.5" aria-hidden /> {after.code}
                </span>
              ))}
          </nav>
        </div>
      )}
    </Page>
  );
}
