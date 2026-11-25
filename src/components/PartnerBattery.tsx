'use client';

import { useEffect, useState } from 'react';
import { Battery as BatteryEmpty, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium } from 'lucide-react';
import { batteryLabel, freshBattery, type Battery } from '@/lib/location';
import { loadLocationState } from '@/hooks/useLocation';
import { getLang, tr } from '@/lib/i18n';

/*
  The partner's charge, read from «Где мы»: it rides with their point, so it is
  there only while you both share, and gone once the point is an hour old.
*/
export function usePartnerBattery(enabled = true) {
  const [battery, setBattery] = useState<Battery | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      const state = await loadLocationState();
      if (!cancelled) setBattery(freshBattery(state?.partner));
    };
    load();
    const timer = setInterval(load, 60_000);
    document.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [enabled]);

  return battery;
}

function BatteryIcon({ battery, className }: { battery: Battery; className: string }) {
  if (battery.charging) return <BatteryCharging className={className} aria-hidden />;
  if (battery.level <= 15) return <BatteryEmpty className={className} aria-hidden />;
  if (battery.level <= 40) return <BatteryLow className={className} aria-hidden />;
  if (battery.level <= 80) return <BatteryMedium className={className} aria-hidden />;
  return <BatteryFull className={className} aria-hidden />;
}

/* A small tag pinned to the partner's avatar: «84 %». Low charge turns it red; charging adds the bolt. */
export function PartnerBatteryBadge({ battery, name }: { battery: Battery | null; name: string }) {
  if (!battery) return null;
  const low = battery.level <= 15 && !battery.charging;
  return (
    <span
      role="img"
      aria-label={tr(`Заряд телефона: ${name}, ${batteryLabel(battery, getLang())}`, `${name}’s phone: ${batteryLabel(battery, getLang())}`)}
      title={batteryLabel(battery, getLang())}
      className={`absolute -right-2 -bottom-1.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-surface px-1.5 py-px text-[0.6875rem] leading-4 font-semibold tabular-nums shadow-card ring-1 ring-line ${
        low ? 'text-danger' : 'text-ink-soft'
      }`}
    >
      <BatteryIcon battery={battery} className="size-3.5" />
      {battery.level}%
    </span>
  );
}
