/*
  The moon as a neutral-ink drawing: a disc outline with the lit part filled.
  Ink only — the colour spectrum belongs to mood and nothing else.
  `phase`: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
*/
export function MoonGlyph({ phase, size = 16, className = '' }: { phase: number; size?: number; className?: string }) {
  const r = 7;
  const c = 8;
  const p = ((phase % 1) + 1) % 1;
  const waxing = p < 0.5;
  /* Terminator ellipse half-width: r at new/full, 0 at the quarters. */
  const k = Math.cos(2 * Math.PI * p);
  /* Rounded: Math.cos may differ in the last bits between server and browser, which breaks hydration. */
  const rx = Math.round(Math.abs(k) * r * 1000) / 1000;

  let lit: string;
  if (p < 0.02 || p > 0.98) {
    lit = '';
  } else if (Math.abs(p - 0.5) < 0.02) {
    lit = `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c} ${c + r} A ${r} ${r} 0 1 1 ${c} ${c - r} Z`;
  } else {
    /* Lit limb on the right while waxing (northern hemisphere view), left while waning. */
    const limbSweep = waxing ? 1 : 0;
    const gibbous = Math.abs(p - 0.5) < 0.25;
    const termSweep = waxing === gibbous ? 1 : 0;
    lit = `M ${c} ${c - r} A ${r} ${r} 0 0 ${limbSweep} ${c} ${c + r} A ${rx} ${r} 0 0 ${termSweep} ${c} ${c - r} Z`;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={1.25} />
      {lit && <path d={lit} fill="currentColor" />}
    </svg>
  );
}
