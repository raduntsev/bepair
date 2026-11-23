'use client';

import { useState } from 'react';

/*
  The loading pair: the two halves of the pair mark as two round characters,
  indigo for you and amber for your partner, glints for eyes. Indigo is
  curious and bouncy, amber calmer and a little shy.

  Not one loop but a small repertoire, so the wait never looks the same twice
  in a row. Each scene is a CSS class (`pair-loader--<scene>` in globals.css):

  loading
    talk    — nudge, look up, shrink into «typing…» dots, jump for joy
    ball    — toss a ball from head to head, then cheer
    swap    — leapfrog: trade places and trade back
    hug     — roll together, squeeze, a heart pops up
    seesaw  — hop in turns, faster and faster, spin, wobble dizzy
  idle (empty states: nothing is loading, so nobody turns into dots)
    idle    — glance, nudge, squint, sway
    nap     — dozing; amber leans in, indigo wakes, smiles, dozes off again
    peek    — catch each other's eye, look away shyly, peek again

  Every layer is its own <g> so motions add up without fighting: position
  (hops), body (squash, stretch, sway, spin), look (where the eyes point), and
  the eyes themselves (blink, surprise, or the happy ^ ^).
*/
const LOADING = ['talk', 'ball', 'swap', 'hug', 'seesaw'] as const;
const IDLE = ['idle', 'nap', 'peek'] as const;
export type PairScene = (typeof LOADING)[number] | (typeof IDLE)[number];

/* Remembered across mounts: the next loader never repeats the scene just seen. */
let lastScene: PairScene | null = null;

function pick(list: readonly PairScene[]): PairScene {
  const options = list.filter((s) => s !== lastScene);
  const scene = options[Math.floor(Math.random() * options.length)];
  lastScene = scene;
  return scene;
}

function Character({ who, cx }: { who: 'you' | 'partner'; cx: number }) {
  const fill = who === 'you' ? 'var(--c-accent)' : 'var(--c-partner)';
  const ex = cx + 1.8;
  return (
    <g className={`pair-loader__pos pair-loader__pos--${who}`}>
      <g className={`pair-loader__body pair-loader__body--${who}`}>
        <circle cx={cx} cy="30" r="17" fill={fill} />
        <g className={`pair-loader__look pair-loader__look--${who}`}>
          <g className={`pair-loader__eyes pair-loader__eyes--${who}`}>
            <rect x={ex - 1.8} y="19" width="3.6" height="8.5" rx="1.8" fill="#fff" transform={`rotate(18 ${ex} 23.25)`} />
            <rect x={ex + 4.2} y="20" width="3.6" height="8.5" rx="1.8" fill="#fff" transform={`rotate(18 ${ex + 6} 24.25)`} />
          </g>
          <g className={`pair-loader__happy pair-loader__happy--${who}`} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
            <path d={`M${ex - 3} 25 Q${ex - 0.6} 21.2 ${ex + 1.8} 25`} />
            <path d={`M${ex + 4.6} 25 Q${ex + 7} 21.2 ${ex + 9.4} 25`} />
          </g>
        </g>
      </g>
    </g>
  );
}

export function PairLoader({
  className = '',
  mode = 'loading',
  scene: forced,
}: {
  className?: string;
  mode?: 'loading' | 'idle';
  /* Pin a scene (previews, tests); otherwise one is drawn at random per mount. */
  scene?: PairScene;
}) {
  const list = mode === 'idle' ? IDLE : LOADING;
  /* The server always draws the first scene; the browser picks freely. A differing class is left as rendered. */
  const [scene] = useState<PairScene>(() => forced ?? (typeof window === 'undefined' ? list[0] : pick(list)));
  return (
    <svg
      viewBox="0 0 120 60"
      suppressHydrationWarning
      className={`pair-loader ${mode === 'idle' ? 'pair-loader--idle' : ''} pair-loader--${scene} ${className}`}
      aria-hidden
      focusable="false"
    >
      <circle className="pair-loader__mid" cx="60" cy="30" r="5" fill="var(--c-ink-faint)" />
      <Character who="you" cx={34} />
      <Character who="partner" cx={86} />
      <path
        className="pair-loader__heart"
        d="M60 10.5C53.2 5.6 53.6 0 57.2 0c1.4 0 2.4.9 2.8 1.9.4-1 1.4-1.9 2.8-1.9 3.6 0 4 5.6-2.8 10.5z"
        fill="var(--c-danger)"
      />
    </svg>
  );
}
