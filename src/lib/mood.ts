import { tr } from '@/lib/i18n';

/*
  Mood is stored as a float 0..1 and read as colour, never as a number.
  A 1–10 readout was rejected deliberately: it makes days comparable.
  There are no captions either: green or red means whatever the person decides.
*/

interface Stop {
  at: number;
  rgb: [number, number, number];
}

const STOPS: Stop[] = [
  { at: 0, rgb: [63, 164, 107] },
  { at: 0.25, rgb: [124, 184, 90] },
  { at: 0.5, rgb: [230, 176, 46] },
  { at: 0.75, rgb: [228, 130, 60] },
  { at: 1, rgb: [210, 80, 75] },
];

export function moodColor(value: number): string {
  const v = Math.min(1, Math.max(0, value));
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];

  for (let i = 0; i < STOPS.length - 1; i += 1) {
    if (v >= STOPS[i].at && v <= STOPS[i + 1].at) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }

  const span = hi.at - lo.at;
  const t = span === 0 ? 0 : (v - lo.at) / span;
  const channel = (i: number) => Math.round(lo.rgb[i] + (hi.rgb[i] - lo.rgb[i]) * t);

  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

/*
  What each colour means is the person's own: the app never names a day light
  or heavy. The colour's name is what a screen reader announces and what a
  colour-blind user reads, so the scale is still not colour-only.
*/
export function moodColorName(value: number): string {
  if (value < 0.15) return tr('зелёный', 'green');
  if (value < 0.38) return tr('салатовый', 'yellow-green');
  if (value < 0.62) return tr('жёлтый', 'yellow');
  if (value < 0.85) return tr('оранжевый', 'orange');
  return tr('красный', 'red');
}

/*
  Three words a widget character can act out: a light day, an ordinary one, a
  heavy one. Coarser than the colour name on purpose — a pose has to read at a glance.
*/
export type MoodLevel = 'light' | 'normal' | 'heavy';

export function moodLevel(value: number): MoodLevel {
  if (value < 0.35) return 'light';
  if (value < 0.65) return 'normal';
  return 'heavy';
}

/*
  Ink for text sitting ON a mood colour. One value across the whole spectrum:
  it clears 4.5:1 at every stop, and the red end is the tightest at exactly 4.5.
  Mood colour is never used as text colour on a neutral surface — it fails
  contrast there — so it always appears as a filled shape beside its label.
*/
export const MOOD_INK = '#101018';

/* The same colour as #rrggbb, for native widgets that do not parse CSS rgb(). */
export function moodHex(value: number): string {
  const [r, g, b] = moodColor(value).match(/\d+/g)!.map(Number);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
