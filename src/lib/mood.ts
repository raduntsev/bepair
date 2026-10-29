/*
  Mood is stored as a float 0..1 and read as colour, never as a number.
  A 1–10 readout was rejected deliberately: it makes days comparable.
  The verbal label exists so the scale is not colour-only — it is what a
  screen reader announces and what a colour-blind user reads.
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

export function moodLabel(value: number): string {
  if (value < 0.2) return 'лёгкий';
  if (value < 0.4) return 'спокойный';
  if (value < 0.6) return 'обычный';
  if (value < 0.8) return 'непростой';
  return 'тяжёлый';
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
