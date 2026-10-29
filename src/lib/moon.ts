/*
  Moon phases without any external service. The four principal phases are
  computed with Meeus, «Astronomical Algorithms», ch. 49 (main periodic terms):
  accurate to a minute or two, so the phase lands on the right local day.
  Everything in between — the name of the current phase and how much of the
  disc is lit — is interpolated between the surrounding new moons.
*/

export type Principal = 'new' | 'first' | 'full' | 'last';

export interface PhaseEvent {
  kind: Principal;
  at: Date;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const JD_UNIX_EPOCH = 2440587.5;

function principalJDE(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = rad(2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3);
  const Mp = rad(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
  const F = rad(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
  const O = rad(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);
  const sin = Math.sin;
  const frac = Math.round((k - Math.floor(k)) * 4) % 4;

  if (frac === 0 || frac === 2) {
    const full = frac === 2;
    jde +=
      (full ? -0.40614 : -0.4072) * sin(Mp) +
      (full ? 0.17302 : 0.17241) * E * sin(M) +
      (full ? 0.01614 : 0.01608) * sin(2 * Mp) +
      (full ? 0.01043 : 0.01039) * sin(2 * F) +
      (full ? 0.00734 : 0.00739) * E * sin(Mp - M) -
      (full ? 0.00515 : 0.00514) * E * sin(Mp + M) +
      (full ? 0.00209 : 0.00208) * E * E * sin(2 * M) -
      0.00111 * sin(Mp - 2 * F) -
      0.00057 * sin(Mp + 2 * F) +
      0.00056 * E * sin(2 * Mp + M) -
      0.00042 * sin(3 * Mp) +
      0.00042 * E * sin(M + 2 * F) +
      0.00038 * E * sin(M - 2 * F) -
      0.00024 * E * sin(2 * Mp - M) -
      0.00017 * sin(O);
  } else {
    jde +=
      -0.62801 * sin(Mp) +
      0.17172 * E * sin(M) -
      0.01183 * E * sin(Mp + M) +
      0.00862 * sin(2 * Mp) +
      0.00804 * sin(2 * F) +
      0.00454 * E * sin(Mp - M) +
      0.00204 * E * E * sin(2 * M) -
      0.0018 * sin(Mp - 2 * F) -
      0.0007 * sin(Mp + 2 * F) -
      0.0004 * sin(3 * Mp) -
      0.00034 * E * sin(2 * Mp - M) +
      0.00032 * E * sin(M + 2 * F) +
      0.00032 * E * sin(M - 2 * F) -
      0.00028 * E * E * sin(Mp + 2 * M) +
      0.00027 * E * sin(2 * Mp + M) -
      0.00017 * sin(O);
    const W =
      0.00306 -
      0.00038 * E * Math.cos(M) +
      0.00026 * Math.cos(Mp) -
      0.00002 * Math.cos(Mp - M) +
      0.00002 * Math.cos(Mp + M) +
      0.00002 * Math.cos(2 * F);
    jde += frac === 1 ? W : -W;
  }
  return jde;
}

/* Dynamical time runs about 69 s ahead of UTC in the 2020s (ΔT). */
const DELTA_T_MS = 69_000;
const jdeToDate = (jde: number) => new Date((jde - JD_UNIX_EPOCH) * 86400000 - DELTA_T_MS);

const KINDS: Principal[] = ['new', 'first', 'full', 'last'];

/* All principal phases between two instants, in order. */
export function phasesBetween(from: Date, to: Date): PhaseEvent[] {
  const years = (d: Date) => d.getUTCFullYear() + (d.getUTCMonth() + d.getUTCDate() / 31) / 12;
  const k0 = Math.floor((years(from) - 2000) * 12.3685) - 1;
  const k1 = Math.ceil((years(to) - 2000) * 12.3685) + 1;
  const out: PhaseEvent[] = [];
  for (let k = k0; k <= k1; k += 1) {
    for (let q = 0; q < 4; q += 1) {
      const at = jdeToDate(principalJDE(k + q / 4));
      if (at >= from && at <= to) out.push({ kind: KINDS[q], at });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export const PRINCIPAL_LABEL: Record<Principal, string> = {
  new: 'новолуние',
  first: 'первая четверть',
  full: 'полнолуние',
  last: 'последняя четверть',
};

export interface MoonToday {
  /* 0 at new moon, 0.5 at full, back to 1. */
  phase: number;
  /* Share of the disc that is lit, 0..1. */
  lit: number;
  waxing: boolean;
  label: string;
}

const DAY = 86400000;

export function moonAt(when: Date): MoonToday {
  /* Interpolate inside the quarter that contains `when`: each quarter is exactly 0.25 of the cycle. */
  const around = phasesBetween(new Date(when.getTime() - 10 * DAY), new Date(when.getTime() + 10 * DAY));
  const prev = [...around].reverse().find((e) => e.at <= when) ?? around[0];
  const next = around.find((e) => e.at > when) ?? around[around.length - 1];
  const span = next.at.getTime() - prev.at.getTime();
  const within = span > 0 ? Math.min(1, Math.max(0, (when.getTime() - prev.at.getTime()) / span)) : 0;
  const phase = (KINDS.indexOf(prev.kind) + within) / 4;
  const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const waxing = phase < 0.5;

  /* Principal phases are moments; each name is given a day and a half on either side. */
  const age = phase * 29.53;
  const label =
    age < 1.5 || age > 28.03
      ? 'новолуние'
      : age < 6.2
        ? 'растущий серп'
        : age < 8.9
          ? 'первая четверть'
          : age < 13.3
            ? 'растущая луна'
            : age < 16.3
              ? 'полнолуние'
              : age < 20.6
                ? 'убывающая луна'
                : age < 23.4
                  ? 'последняя четверть'
                  : 'убывающий серп';
  return { phase, lit, waxing, label };
}
