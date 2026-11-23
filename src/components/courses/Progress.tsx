'use client';

import { Check, Lock } from 'lucide-react';
import type { Course } from '@/lib/courses';
import { isOpen, nextLesson, progressOf, stepLabel } from '@/lib/courses';
import { verb, type Gender } from '@/lib/words';
import { tr } from '@/lib/i18n';

/* Two thin bars, yours in indigo and the partner's in amber — the pair's colours, never mood's. */
export function PairProgress({
  course,
  mine,
  theirs,
  partnerName,
  partnerGender,
  partnerStarted,
}: {
  course: Course;
  mine: Set<string>;
  theirs: Set<string> | null;
  partnerName: string;
  partnerGender?: Gender;
  partnerStarted: boolean;
}) {
  const me = progressOf(course, mine);
  const them = theirs ? progressOf(course, theirs) : null;
  const myNext = nextLesson(course, mine);
  const theirNext = theirs ? nextLesson(course, theirs) : null;

  return (
    <div className="space-y-3">
      <Bar
        who="me"
        label={tr('Вы', 'You')}
        value={me.count}
        total={me.total}
        status={me.finished ? tr('курс пройден', 'finished') : me.count === 0 ? tr('ещё не начали', 'not started') : sentenceStep(myNext)}
      />
      {them && (
        <Bar
          who="partner"
          label={partnerName}
          value={them.count}
          total={them.total}
          status={them.finished ? tr('курс пройден', 'finished') : !partnerStarted && them.count === 0 ? tr(`ещё не ${verb(partnerGender, 'начинал')}`, 'not started yet') : sentenceStep(theirNext)}
        />
      )}
    </div>
  );
}

function sentenceStep(lesson: { code: string; kind: 'lesson' | 'practice' | 'final' } | null) {
  if (!lesson) return '';
  const label = stepLabel(lesson);
  return tr(`сейчас: ${label}`, `now: ${lesson.kind === 'final' ? 'final reflection' : lesson.code.startsWith('М') ? `practice ${lesson.code.replace('М', 'M')}` : `lesson ${lesson.code}`}`);
}

function Bar({ who, label, value, total, status }: { who: 'me' | 'partner'; label: string; value: number; total: number; status: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-subhead">
        <span className="min-w-0 truncate">
          <span className={`font-semibold ${who === 'me' ? 'text-ink' : 'text-partner-ink'}`}>{label}</span>
          {status && <span className="text-ink-faint"> · {status}</span>}
        </span>
        <span className="shrink-0 text-footnote text-ink-faint tabular-nums">
          {value} {tr('из', 'of')} {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken"
      >
        <span className={`block h-full rounded-full transition-[width] duration-700 ${who === 'me' ? 'bg-accent' : 'bg-partner'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* The circle at the start of a lesson row: done, here now, or still closed. */
export function StepDot({ state }: { state: 'done' | 'current' | 'locked' | 'open' }) {
  if (state === 'done')
    return (
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
        <Check className="size-4" strokeWidth={2.8} />
      </span>
    );
  if (state === 'locked')
    return (
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-faint">
        <Lock className="size-3.5" />
      </span>
    );
  return <span aria-hidden className={`size-8 shrink-0 rounded-full border-2 ${state === 'current' ? 'border-accent' : 'border-line-strong'}`} />;
}

export function stepState(course: Course, lessonId: string, done: Set<string>): 'done' | 'current' | 'locked' {
  if (done.has(lessonId)) return 'done';
  return isOpen(course, lessonId, done) ? 'current' : 'locked';
}
