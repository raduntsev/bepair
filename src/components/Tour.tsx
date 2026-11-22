'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { PairMark } from '@/components/PairMark';
import { Button } from '@/components/ui/Button';

/*
  «Обучение» — a walk through the real app, not a slideshow about it. Each step
  opens the screen it talks about, dims everything else and lights the one
  thing it means, with a card beside it saying what it is for.

  The light is a single rounded box whose shadow is the dimming: it travels
  from target to target on one curve, so the eye follows it from screen to
  screen instead of the overlay blinking out and back. Targets are marked in
  the markup with `data-tour`; a step whose target never appears (a section
  that is empty for this couple) falls back to a centred card rather than
  stalling the tour.

  Runs once on its own, the first time the app opens after onboarding, and
  again whenever it is asked for from «Профиль».
*/

export interface TourStep {
  /* Screen to open first; absent means «wherever we are». */
  route?: string;
  /* The `data-tour` value to light; absent means a centred card. */
  target?: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    title: 'Впаре — пространство для двоих',
    body: 'Здесь вы каждый день честно сверяетесь, как дела друг у друга, просите о мелочах без напряжения и пишете письма, которые ждут своего часа. Покажу, где что, — это минута.',
  },
  {
    route: '/day',
    target: 'day-mood',
    title: 'Ваш день',
    body: 'Главное за день: отметьте настроение цветом — без цифр и оценок — и добавьте пару слов, почему так. Это занимает полминуты.',
  },
  {
    route: '/day',
    target: 'day-partner',
    title: 'День партнёра',
    body: 'Откроется, когда вы отметите свой. Так честно: вы открываетесь друг другу одновременно и никто не подглядывает.',
  },
  {
    route: '/day',
    target: 'day-bell',
    title: 'Уведомления',
    body: 'Всё, что случилось, пока вас не было: партнёр отметил день, пришло письмо, выполнена просьба. Цифра — сколько нового.',
  },
  {
    route: '/day',
    target: 'island',
    title: 'Все разделы здесь',
    body: 'Нажмите на капсулу — она раскроется в список: Сегодня, Переписка, Просьбы, Календарь и Профиль.',
  },
  {
    route: '/day',
    target: 'compose',
    title: 'Написать партнёру',
    body: 'Короткая весточка в одно касание — с любого экрана. Можно приложить снимок, голос или песню.',
  },
  {
    route: '/messages',
    target: 'messages-input',
    title: 'Переписка',
    body: 'Весточки и письма в одной ленте, а то, что ждёт вас, — наверху. Внизу строка для быстрой записки.',
  },
  {
    route: '/messages',
    target: 'messages-letter',
    title: 'Письма',
    body: 'Письмо можно оставить черновиком, отправить к нужному часу или запечатать, пока партнёр не отметит свой день.',
  },
  {
    route: '/tasks',
    target: 'tasks-compose',
    title: 'Просьбы',
    body: 'Попросите о чём-то — без требований и напоминаний. Укажите, насколько это важно: за выполнение партнёр получает баллы.',
  },
  {
    route: '/tasks',
    target: 'exchange-tabs',
    title: 'Услуги',
    body: 'Баллы тратятся на то, что предлагает партнёр: ужин, массаж, вечер без посуды — что придумаете сами.',
  },
  {
    route: '/calendar',
    target: 'calendar-grid',
    title: 'Календарь',
    body: 'Все ваши дни. Видно, когда отметились оба, и в любой день можно вернуться и перечитать.',
  },
  {
    route: '/planerka',
    target: 'planerka-start',
    title: 'Планёрка',
    body: 'Раз в неделю садитесь вместе: колесо баланса из семи сфер с объяснением каждой оценки, четыре вопроса друг другу и общие дела.',
  },
  {
    route: '/planerka',
    target: 'planerka-schedule',
    title: 'Когда встречаетесь',
    body: 'День и время планёрки настраиваются здесь один раз. В этот день она сама появится на экране «Сегодня».',
  },
  {
    route: '/planerka',
    target: 'planerka-views',
    title: 'История',
    body: 'Как менялось колесо, что вы отвечали раньше и какие дела ещё ждут — всё по неделям.',
  },
  {
    route: '/settings',
    target: 'profile-pair',
    title: 'Вы вдвоём',
    body: 'Наверху — вы: фото, имя, как к вам обращаться. Ниже — профиль пары: сколько вы вместе, важные даты, ответы друг о друге.',
  },
  {
    route: '/settings',
    target: 'profile-settings',
    title: 'Настройки',
    body: 'Тема, уведомления и виджеты. Парные настройки меняются только с согласия обоих.',
  },
  {
    route: '/settings',
    target: 'profile-tour',
    title: 'Вот и всё',
    body: 'Начните с главного — отметьте сегодняшний день. А пройти обучение ещё раз можно здесь.',
  },
];

const DONE_KEY = 'bepair-tour';
const EASE = [0.45, 0, 0.15, 1] as const;
const PAD = 8;
const GAP = 14;
const EDGE = 16;
const CARD_MAX = 360;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

const TourContext = createContext<{ start: () => void }>({ start: () => undefined });

export function useTour() {
  return useContext(TourContext);
}

export function TourProvider({ children, steps = STEPS }: { children: React.ReactNode; steps?: TourStep[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const start = useCallback(() => setIndex(0), []);

  /* The first time the app opens: give the screen a moment to settle, then begin. */
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(DONE_KEY) === 'done';
    } catch {}
    if (seen) return;
    const timer = setTimeout(() => setIndex(0), 1200);
    return () => clearTimeout(timer);
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, 'done');
    } catch {}
    setIndex(null);
  }, []);

  return (
    <TourContext.Provider value={{ start }}>
      {children}
      <AnimatePresence>{index !== null && <TourOverlay key="tour" steps={steps} index={index} onIndex={setIndex} onClose={finish} />}</AnimatePresence>
    </TourContext.Provider>
  );
}

function isFixed(el: HTMLElement) {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).position === 'fixed') return true;
  }
  return false;
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14;
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2, r: Math.min(radius + PAD, (r.height + PAD * 2) / 2) };
}

const same = (a: Box | null, b: Box | null) =>
  !!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

function useViewport() {
  const [size, setSize] = useState(() =>
    typeof window === 'undefined' ? { w: 390, h: 800 } : { w: window.innerWidth, h: window.innerHeight },
  );
  useEffect(() => {
    const read = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return size;
}

function TourOverlay({
  steps,
  index,
  onIndex,
  onClose,
}: {
  steps: TourStep[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const view = useViewport();
  const step = steps[index];
  const last = index === steps.length - 1;

  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);

  /* Open the step's screen. */
  useEffect(() => {
    if (step.route && pathname !== step.route) router.push(step.route);
  }, [step.route, pathname, router]);

  /*
    Find the target once its screen has rendered, bring it into view, then keep
    the light on it every frame — screens fade in, cards spring open, and the
    box should follow rather than be left behind.
  */
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const began = performance.now();

    if (!step.target) {
      frame = requestAnimationFrame(() => setBox(null));
      return () => cancelAnimationFrame(frame);
    }

    const track = (el: HTMLElement) => {
      if (cancelled) return;
      const next = boxOf(el);
      setBox((prev) => (same(prev, next) ? prev : next));
      frame = requestAnimationFrame(() => track(el));
    };

    const find = () => {
      if (cancelled) return;
      const onScreen = !step.route || window.location.pathname === step.route;
      const el = onScreen ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      if (el && el.getBoundingClientRect().height > 0) {
        const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
        if (isFixed(el)) {
          window.scrollTo({ top: 0, behavior });
        } else {
          const r = el.getBoundingClientRect();
          /* Tall blocks go near the top so the card fits under them; the rest sit a little above centre. */
          const offset = r.height > window.innerHeight * 0.45 ? 24 : Math.max(24, (window.innerHeight - r.height) / 2 - 80);
          window.scrollTo({ top: window.scrollY + r.top - offset, behavior });
        }
        /* Follow it while the page scrolls: the light travels with the content, never ahead of it. */
        track(el);
        return;
      }
      if (performance.now() - began > 5000) {
        setBox(null);
        return;
      }
      frame = requestAnimationFrame(find);
    };

    frame = requestAnimationFrame(find);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [step, reduce]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const read = () => setCardH(el.offsetHeight);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0) return;
      if (next >= steps.length) onClose();
      else onIndex(next);
    },
    [index, steps.length, onIndex, onClose],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [index]);

  /* The card goes below the light, or above it, or — if neither fits — at the bottom of the screen. */
  const cardW = Math.min(CARD_MAX, view.w - EDGE * 2);
  let top = (view.h - cardH) / 2;
  let left = (view.w - cardW) / 2;
  if (box) {
    const below = view.h - (box.y + box.h) - GAP - EDGE;
    const above = box.y - GAP - EDGE;
    if (below >= cardH) top = box.y + box.h + GAP;
    else if (above >= cardH) top = box.y - GAP - cardH;
    else top = view.h - cardH - EDGE;
    left = Math.min(Math.max(box.x + box.w / 2 - cardW / 2, EDGE), view.w - cardW - EDGE);
  }

  /*
    A spring rather than a fixed-length tween: the target moves every frame while
    the page scrolls, and a spring takes each new aim from its current speed, so
    the light glides instead of restarting a curve sixty times a second.
  */
  const move = reduce ? { duration: 0 } : ({ type: 'spring', stiffness: 140, damping: 24, mass: 1 } as const);
  const fill = reduce ? { duration: 0 } : { duration: 0.7, ease: EASE };
  const light = box
    ? { x: box.x, y: box.y, width: box.w, height: box.h, borderRadius: box.r }
    : { x: view.w / 2, y: view.h / 2, width: 0, height: 0, borderRadius: 0 };

  return (
    <motion.div
      className="fixed inset-0 z-[70]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE }}
    >
      {/* Catches taps so the app underneath cannot be used mid-tour. */}
      <div className="absolute inset-0" aria-hidden />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0"
        initial={false}
        animate={light}
        transition={move}
        style={{
          boxShadow: box
            ? '0 0 0 2px rgba(255,255,255,0.85), 0 0 24px 4px rgba(88,86,214,0.45), 0 0 0 200vmax rgba(6,6,16,0.66)'
            : '0 0 0 200vmax rgba(6,6,16,0.66)',
        }}
      />

      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        initial={false}
        animate={{ x: left, y: top }}
        transition={move}
        className="absolute top-0 left-0 rounded-[1.5rem] bg-surface p-5 outline-none"
        style={{ width: cardW, boxShadow: 'var(--sh-lift)' }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-footnote text-ink-faint tabular-nums" aria-live="polite">
            {index + 1} из {steps.length}
          </span>
          {!last && (
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 inline-flex h-9 items-center gap-1 rounded-full px-3 text-footnote font-medium text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
            >
              Пропустить <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={reduce ? false : { opacity: 0, y: 6, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? undefined : { opacity: 0, y: -4, filter: 'blur(3px)' }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {index === 0 && <PairMark className="mb-3 size-12" />}
            <h2 id="tour-title" className="text-title-3 font-semibold">
              {step.title}
            </h2>
            <p id="tour-body" className="mt-1.5 text-body text-ink-soft">
              {step.body}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={false}
            animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
            transition={fill}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          {index > 0 ? (
            <Button variant="ghost" onClick={() => go(-1)}>
              Назад
            </Button>
          ) : (
            <span />
          )}
          {last ? (
            <Button
              onClick={() => {
                onClose();
                router.push('/day');
              }}
            >
              Отметить день
            </Button>
          ) : (
            <Button onClick={() => go(1)}>{index === 0 ? 'Показать' : 'Далее'}</Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
