'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Award, Brain, Compass, Flame, Gem, Lock, Mountain, Route, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { courseById, type BadgeIcon, type Course, type Module } from '@/lib/courses';
import { fmt, plural } from '@/lib/dates';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { PairLoader } from '@/components/PairLoader';
import { celebrateBig, celebrateStep, praise } from '@/lib/celebrate';
import { isEnglish, tr } from '@/lib/i18n';

const ICONS: Record<BadgeIcon, LucideIcon> = {
  gem: Gem,
  mountain: Mountain,
  brain: Brain,
  compass: Compass,
  waves: Waves,
  shield: ShieldCheck,
  route: Route,
  award: Award,
};

export const daysRu = (n: number) => plural(n, 'день', 'дня', 'дней');
const pointsRu = (n: number) => plural(n, 'балл', 'балла', 'баллов');

/* One badge: the module's sign in the accent once earned, a quiet lock until then. */
export function Badge({ icon, earned, size = 'md' }: { icon: BadgeIcon; earned: boolean; size?: 'md' | 'lg' }) {
  const Icon = ICONS[icon];
  const box = size === 'lg' ? 'size-24' : 'size-14';
  const glyph = size === 'lg' ? 'size-11' : 'size-6';
  return (
    <span
      aria-hidden
      className={`relative flex ${box} shrink-0 items-center justify-center rounded-full ${earned ? 'bg-accent text-accent-ink shadow-card' : 'bg-sunken text-ink-faint'}`}
    >
      <Icon className={glyph} strokeWidth={1.8} />
      {!earned && (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-surface text-ink-faint shadow-card">
          <Lock className="size-3" />
        </span>
      )}
    </span>
  );
}

/*
  The run, the points and the badges — what the course has given so far.
  Three plain numbers, then the shelf: eight badges, earned ones in the accent,
  an amber dot on those the partner has too. Every badge is a button: an
  earned one tells when and for what, a closed one what it takes and how many
  steps are left.
*/
export function RewardsCard({
  course,
  streak,
  points,
  mine,
  earnedAt,
  done,
  theirs,
  partnerName,
}: {
  course: Course;
  streak: number;
  points: number;
  mine: Set<string>;
  /* When each earned badge was earned (the module's last step). */
  earnedAt: Map<string, string>;
  /* Lessons you have done, to count what is left in a module. */
  done: Set<string>;
  theirs: Set<string> | null;
  partnerName: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const chosen = course.modules.find((m) => m.id === open) ?? null;

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card" aria-labelledby="rewards-title">
      <h2 id="rewards-title" className="text-headline font-semibold">
        {tr('Награды', 'Rewards')}
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label={tr(`${daysRu(streak)} подряд`, streak === 1 ? 'day in a row' : 'days in a row')} value={streak} Icon={Flame} />
        <Stat label={tr(pointsRu(points), points === 1 ? 'point' : 'points')} value={points} Icon={Sparkles} />
        <Stat label={tr('значков', 'badges')} value={`${mine.size}/${course.modules.length}`} Icon={Award} />
      </dl>
      <ul className="mt-5 grid grid-cols-4 gap-x-2 gap-y-3">
        {course.modules.map((m) => {
          const earned = mine.has(m.id);
          const partnerHas = !!theirs?.has(m.id);
          const active = open === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-expanded={active}
                aria-controls="badge-detail"
                onClick={() => setOpen(active ? null : m.id)}
                className={`flex w-full flex-col items-center rounded-xl px-0.5 py-1.5 text-center transition-colors ${active ? 'bg-sunken' : 'hover:bg-sunken/60'}`}
              >
                <span className="relative">
                  <Badge icon={m.badge.icon} earned={earned} />
                  {partnerHas && (
                    <span
                      title={tr(`Есть у: ${partnerName}`, `${partnerName} has it`)}
                      className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-partner ring-2 ring-surface"
                    />
                  )}
                </span>
                <span className={`mt-1.5 text-caption leading-tight ${earned ? 'text-ink' : 'text-ink-faint'}`}>{m.badge.name}</span>
                <span className="sr-only">
                  {earned ? tr('получен', 'earned') : tr('ещё не получен', 'not earned yet')}
                  {partnerHas ? tr(`, есть у: ${partnerName}`, `, ${partnerName} has it`) : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <AutoHeight>
        {chosen && (
          <motion.div
            id="badge-detail"
            key={chosen.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 flex gap-3.5 rounded-xl bg-sunken p-3.5"
          >
            <Badge icon={chosen.badge.icon} earned={mine.has(chosen.id)} />
            <BadgeStory module={chosen} earned={mine.has(chosen.id)} at={earnedAt.get(chosen.id)} done={done} partnerHas={!!theirs?.has(chosen.id)} partnerName={partnerName} />
          </motion.div>
        )}
      </AutoHeight>

      {theirs && theirs.size > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-footnote text-ink-faint">
          <span aria-hidden className="size-2.5 rounded-full bg-partner" /> {tr(`значки, которые есть у: ${partnerName}`, `badges ${partnerName} has`)}
        </p>
      )}
    </section>
  );
}

/* What a badge is for: when it came, or what it still takes. */
function BadgeStory({
  module,
  earned,
  at,
  done,
  partnerHas,
  partnerName,
}: {
  module: Module;
  earned: boolean;
  at?: string;
  done: Set<string>;
  partnerHas: boolean;
  partnerName: string;
}) {
  const total = module.lessons.length;
  const left = module.lessons.filter((l) => !done.has(l.id)).length;
  const what = module.id === 'final' ? tr('итоговую работу курса', 'the final reflection') : tr(`модуль ${module.n} «${module.title}»`, `module ${module.n}, “${module.title}”`);
  return (
    <div className="min-w-0 flex-1">
      <p className="text-subhead font-semibold">«{module.badge.name}»</p>
      {earned ? (
        <p className="mt-0.5 text-footnote text-ink-soft">
          {tr(`Получен${at ? ` ${fmt(at, 'd MMMM')}` : ''} за ${what}. +10 баллов.`, `Earned${at ? ` on ${fmt(at, 'd MMMM')}` : ''} for ${what}. +10 points.`)}
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-footnote text-ink-soft">
            {tr(`Откроется, когда вы пройдёте ${what}. Награда — значок и +10 баллов.`, `Unlocks when you finish ${what}. Reward: the badge and +10 points.`)}
          </p>
          <p className="mt-1.5 text-footnote font-medium text-accent-soft-ink">
            {left === total
              ? tr(`Впереди ${total} ${plural(total, 'шаг', 'шага', 'шагов')}`, `${total} ${total === 1 ? 'step' : 'steps'} ahead`)
              : tr(`Осталось ${left} ${plural(left, 'шаг', 'шага', 'шагов')} из ${total}`, `${left} of ${total} ${total === 1 ? 'step' : 'steps'} left`)}
          </p>
          <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${((total - left) / total) * 100}%` }} />
          </span>
        </>
      )}
      {partnerHas && <p className="mt-1.5 text-footnote text-partner-ink">{tr(`У ${partnerName} уже есть`, `${partnerName} already has it`)}</p>}
    </div>
  );
}

function Stat({ label, value, Icon }: { label: string; value: number | string; Icon: LucideIcon }) {
  return (
    <div className="rounded-xl bg-sunken px-2 py-3">
      <dt className="sr-only">{label}</dt>
      <dd>
        <Icon className="mx-auto size-4.5 text-accent" aria-hidden />
        <span className="mt-1 block text-title-3 font-bold tabular-nums">{value}</span>
        <span className="block text-caption text-ink-faint">{label}</span>
      </dd>
    </div>
  );
}

/*
  The moment a step pays. A plain step: a short line that fades. A finished
  module (or the course): a sheet with the badge springing in. Driven by the URL
  (`?reward=12&badge=m2&course=who-am-i`), so it survives the move to the next
  lesson, and cleared from the URL once seen.
*/
export function Celebration({ streak }: { streak: number }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const points = Number(params.get('reward') ?? 0);
  const course = courseById(params.get('course'));
  const badgeId = params.get('badge');
  const earned = course && badgeId ? (course.modules.find((m) => m.id === badgeId) ?? null) : null;
  const [toast, setToast] = useState(points > 0 && !earned);
  const [words] = useState(() => (isEnglish() ? 'One more step towards yourself' : praise()));

  /* Every finished step gets confetti; a badge gets the big one. Once per arrival. */
  useEffect(() => {
    if (points <= 0 && !earned) return;
    if (earned) celebrateBig();
    else celebrateStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once for this URL; the component is keyed by it
  }, []);

  const clear = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    ['reward', 'badge', 'course'].forEach((k) => next.delete(k));
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(false);
      clear();
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [toast, clear]);

  const finished = earned?.id === 'final';

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="mb-4 flex items-center gap-3 rounded-2xl bg-accent-soft py-2 pr-4 pl-2 text-accent-soft-ink"
          >
            <PairLoader scene="hug" className="h-12 w-24 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-subhead font-semibold">{words}</span>
              <span className="block text-footnote">
                {tr(`Шаг засчитан · +${points} ${pointsRu(points)}`, `Step done · +${points} ${points === 1 ? 'point' : 'points'}`)}
                {streak > 1 && tr(` · ${streak} ${daysRu(streak)} подряд`, ` · ${streak} days in a row`)}
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!!earned} onClose={clear} title={finished ? tr('Курс пройден', 'Course finished') : tr('Модуль пройден', 'Module finished')}>
        {earned && (
          <div className="flex flex-col items-center pb-2 text-center">
            <motion.div
              initial={reduce ? false : { scale: 0.4, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.25 }}
            >
              <Badge icon={earned.badge.icon} earned size="lg" />
            </motion.div>
            <p className="mt-4 text-footnote text-ink-faint">{finished ? course?.title : `${tr('Модуль', 'Module')} ${earned.n}. ${earned.title}`}</p>
            <h3 className="mt-1 text-title-2 font-bold">
              {tr('Значок', 'Badge')} «{earned.badge.name}»
            </h3>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {points > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-subhead font-semibold text-accent-soft-ink">
                  <Sparkles className="size-4" aria-hidden /> +{points} {tr(pointsRu(points), points === 1 ? 'point' : 'points')}
                </span>
              )}
              {streak > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-3 py-1.5 text-subhead font-medium text-ink-soft">
                  <Flame className="size-4" aria-hidden /> {tr(`${streak} ${daysRu(streak)} подряд`, `${streak} ${streak === 1 ? 'day' : 'days'} in a row`)}
                </span>
              )}
            </div>
            <p className="measure mt-4 text-subhead text-ink-soft">
              {finished
                ? tr('Вы прошли весь путь. Баллы можно потратить на услуги партнёра в «Просьбах».', 'You walked the whole way. Spend the points on your partner’s favours in Requests.')
                : tr('Баллы уже на балансе — их можно потратить на услуги партнёра в «Просьбах».', 'The points are on your balance — spend them on your partner’s favours in Requests.')}
            </p>
            <Button size="lg" block className="mt-6" onClick={clear}>
              {finished ? tr('Готово', 'Done') : tr('Дальше', 'Continue')}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
