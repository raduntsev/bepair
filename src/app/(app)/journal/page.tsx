'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { COURSES, hasContent, lessonsOf } from '@/lib/courses';
import { relativeStamp } from '@/lib/dates';
import { displayName, verb } from '@/lib/words';
import { useCourses, type CoursesStore, type JournalEntry } from '@/hooks/useCourses';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Alert, Card, EmptyState, Loading, Page } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Segment } from '@/components/ui/Controls';
import { Textarea } from '@/components/ui/Field';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { COURSE_TABS, TabbedHeader } from '@/components/TabbedHeader';
import { AnswersView } from '@/components/courses/CourseFields';
import { ThoughtDiary } from '@/components/courses/ThoughtDiary';
import { CoursesUnavailable } from '@/components/courses/Unavailable';
import { tr } from '@/lib/i18n';

type View = 'notes' | 'diary' | 'course';
const EASE = [0.32, 0.72, 0, 1] as const;

export default function JournalPage() {
  return (
    <Suspense fallback={<Loading label={tr('Открываем журнал…', 'Opening the journal…')} />}>
      <JournalView />
    </Suspense>
  );
}

/*
  «Журнал саморефлексии»: everything you have written about yourself in one
  place — free notes, the thought diary, and your answers from the courses,
  lesson by lesson. The partner's journal sits behind the same switch as their
  course answers: all of it, or none.
*/
function JournalView() {
  const params = useSearchParams();
  const store = useCourses();
  const { partner } = useSpaceAuth();
  const partnerName = displayName(partner?.display_name);
  const [who, setWho] = useState<'me' | 'partner'>(params.get('who') === 'partner' && partner ? 'partner' : 'me');
  const [view, setView] = useState<View>('notes');
  const reading = who === 'partner';

  return (
    <Page>
      <TabbedHeader id="courses" title={tr('Курсы', 'Courses')} tabs={COURSE_TABS} current="/journal" />

      {!store.available ? (
        <CoursesUnavailable />
      ) : store.isLoading ? (
        <Loading label={tr('Открываем журнал…', 'Opening the journal…')} />
      ) : (
        <div className="space-y-4">
          {store.error && <Alert>{store.error}</Alert>}

          {partner && (
            <Segment
              legend={tr('Чей журнал', 'Whose journal')}
              options={[
                { value: 'me' as const, label: tr('Мой', 'Mine') },
                { value: 'partner' as const, label: partnerName },
              ]}
              value={who}
              onChange={setWho}
            />
          )}

          {reading && !store.partnerShares ? (
            <EmptyState title={tr(`${partnerName} пока не ${verb(partner?.gender, 'открыл')} журнал`, `${partnerName} hasn’t opened their journal`)}>
              {tr('Ответы и записи появятся здесь, когда партнёр откроет их — сразу все.', 'Answers and entries appear here once your partner opens them — all at once.')}
            </EmptyState>
          ) : (
            <>
              <Segment
                legend={tr('Раздел журнала', 'Journal section')}
                options={[
                  { value: 'notes' as const, label: tr('Записи', 'Notes') },
                  { value: 'diary' as const, label: tr('Дневник', 'Diary') },
                  { value: 'course' as const, label: tr('Курс', 'Course') },
                ]}
                value={view}
                onChange={setView}
              />
              <motion.div key={`${who}-${view}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                {view === 'notes' && <Notes store={store} entries={reading ? store.partnerEntries : store.myEntries} readOnly={reading} />}
                {view === 'diary' && (
                  <Card>
                    <h2 className="text-headline font-semibold">{tr('Дневник мыслей', 'Thought diary')}</h2>
                    <p className="measure mt-1 mb-3 text-subhead text-ink-faint">
                      {tr('Ситуация → мысль → эмоция → реакция.', 'Situation → thought → emotion → reaction.')}
                    </p>
                    {reading && store.partnerEntries.every((e) => e.kind !== 'thought') ? (
                      <p className="text-subhead text-ink-faint">{tr('Записей пока нет', 'No entries yet')}</p>
                    ) : (
                      <ThoughtDiary store={reading ? undefined : store} entries={reading ? store.partnerEntries : store.myEntries} readOnly={reading} />
                    )}
                  </Card>
                )}
                {view === 'course' && <CourseAnswers store={store} userId={reading ? store.partnerId : store.me} readOnly={reading} />}
              </motion.div>
            </>
          )}
        </div>
      )}
    </Page>
  );
}

/* Free notes — «для записей»: anything about yourself that came up outside a lesson. */
function Notes({ store, entries, readOnly }: { store: CoursesStore; entries: JournalEntry[]; readOnly: boolean }) {
  const notes = entries.filter((e) => e.kind === 'note');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const ok = await store.addEntry('note', text.trim());
    setSaving(false);
    if (ok) setText('');
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <Card>
          <label htmlFor="journal-note" className="block text-headline font-semibold">
            {tr('Новая мысль о себе', 'A new thought about yourself')}
          </label>
          <Textarea id="journal-note" rows={4} className="mt-3" value={text} onChange={(event) => setText(event.target.value)} />
          <AutoHeight>
            {text.trim() && (
              <div className="pt-3">
                <Button block loading={saving} onClick={add}>
                  {tr('Записать', 'Save')}
                </Button>
              </div>
            )}
          </AutoHeight>
        </Card>
      )}

      {notes.length === 0 && readOnly && <EmptyState title={tr('Записей пока нет', 'No entries yet')} variant="quiet" />}

      {notes.map((note) => (
        <Card key={note.id} as="article">
          <div className="flex items-center justify-between gap-2">
            <time dateTime={note.created_at} className="text-footnote text-ink-faint first-letter:uppercase">
              {relativeStamp(note.created_at)}
            </time>
            {!readOnly && (
              <button
                type="button"
                aria-label={tr('Ещё', 'More')}
                aria-expanded={menu === note.id}
                onClick={() => setMenu(menu === note.id ? null : note.id)}
                className="tap -my-2 -mr-2 flex items-center justify-center rounded-full text-ink-faint hover:text-ink"
              >
                <MoreHorizontal className="size-5" aria-hidden />
              </button>
            )}
          </div>
          {editing?.id === note.id ? (
            <div className="mt-2 space-y-2">
              <Textarea aria-label={tr('Запись', 'Entry')} rows={4} value={editing.body} onChange={(event) => setEditing({ id: note.id, body: event.target.value })} />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(null)}>
                  {tr('Отмена', 'Cancel')}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!editing.body.trim()}
                  onClick={async () => {
                    if (await store.updateEntry(note.id, { body: editing.body.trim() })) setEditing(null);
                  }}
                >
                  {tr('Сохранить', 'Save')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="measure mt-1.5 text-body whitespace-pre-wrap text-ink">{note.body}</p>
          )}
          {menu === note.id && !editing && (
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing({ id: note.id, body: note.body });
                  setMenu(null);
                }}
              >
                {tr('Изменить', 'Edit')}
              </Button>
              <Button variant="danger" onClick={() => store.removeEntry(note.id)}>
                {tr('Удалить', 'Delete')}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* Course answers, lesson by lesson, in the order of the course. Only lessons with something written. */
function CourseAnswers({ store, userId, readOnly }: { store: CoursesStore; userId: string | null; readOnly: boolean }) {
  const blocks = COURSES.flatMap((course) =>
    lessonsOf(course)
      .map((lesson) => ({ course, lesson, answers: store.answersFor(userId, course.id, lesson.id) }))
      .filter(({ lesson, answers }) => lesson.fields.some((f) => f.kind !== 'diary' && hasContent(answers?.[f.id]))),
  );

  if (blocks.length === 0) {
    return (
      <EmptyState
        title={tr('Ответов пока нет', 'No answers yet')}
        action={
          readOnly ? undefined : (
            <Link href="/courses" className="text-subhead font-semibold text-accent">
              {tr('К курсам', 'To the courses')}
            </Link>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map(({ course, lesson, answers }, i) => {
        const heading = COURSES.length > 1 && blocks[i - 1]?.course.id !== course.id ? course.title : null;
        return (
          <div key={`${course.id}/${lesson.id}`}>
            {heading && <h2 className="mt-4 mb-2 px-1 text-title-3 font-semibold">{heading}</h2>}
            <Card as="article">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-headline font-semibold">
                  <span className="text-ink-faint tabular-nums">{lesson.code}</span> {lesson.title}
                </h3>
                {!readOnly && (
                  <Link
                    href={`/courses/lesson?c=${course.id}&l=${lesson.id}`}
                    aria-label={tr(`Открыть урок ${lesson.code}`, `Open lesson ${lesson.code}`)}
                    className="tap -my-2 -mr-2 flex shrink-0 items-center justify-center rounded-full text-line-strong hover:text-ink"
                  >
                    <ChevronRight className="size-5" aria-hidden />
                  </Link>
                )}
              </div>
              <AnswersView fields={lesson.fields} answers={answers} />
            </Card>
          </div>
        );
      })}
    </div>
  );
}
