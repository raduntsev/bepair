import confetti from 'canvas-confetti';

/*
  Confetti for a finished step, in the pair's own colours — indigo and amber
  with a pale lavender — never green or red, which belong to mood. Drawn on its
  own full-screen canvas above sheets (z 70). Turned off by the library when
  the phone asks for reduced motion.
*/
const COLORS = ['#5b54e8', '#8b85ff', '#d98324', '#e8a552', '#edecfd'];
const BASE = { colors: COLORS, disableForReducedMotion: true, zIndex: 70, ticks: 220 } as const;

/* A step: one cheerful burst from the top of the screen. */
export function celebrateStep() {
  confetti({ ...BASE, particleCount: 80, spread: 80, startVelocity: 36, origin: { x: 0.5, y: 0.2 }, scalar: 0.9 });
}

/* A module or the whole course: two cannons from the sides, then a shower. */
export function celebrateBig() {
  const fire = (x: number, angle: number) =>
    confetti({ ...BASE, particleCount: 70, angle, spread: 60, startVelocity: 55, origin: { x, y: 0.75 } });
  fire(0, 60);
  fire(1, 120);
  window.setTimeout(() => {
    confetti({ ...BASE, particleCount: 120, spread: 120, startVelocity: 30, origin: { x: 0.5, y: 0.1 }, gravity: 0.8, scalar: 1.1 });
  }, 450);
  window.setTimeout(() => {
    fire(0.15, 70);
    fire(0.85, 110);
  }, 1000);
}

/* Words for a finished step: warm, never the same twice in a row. */
const PRAISE = [
  'Ещё один шаг к себе',
  'Честная работа — так и узнают себя',
  'Это было непросто, и вы справились',
  'Вы стали на шаг ближе к себе',
  'Маленький шаг — большое дело',
  'Здорово! Так держать',
  'Вы молодец, что не откладываете',
];
let last = -1;

export function praise() {
  let i = Math.floor(Math.random() * PRAISE.length);
  if (i === last) i = (i + 1) % PRAISE.length;
  last = i;
  return PRAISE[i];
}
