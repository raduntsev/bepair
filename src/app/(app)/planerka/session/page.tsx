'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fmt, todayISO } from '@/lib/dates';
import { Loading, PageHeader } from '@/components/ui/Blocks';
import { PlanerkaSession } from '@/components/PlanerkaSession';

export default function PlanerkaSessionPage() {
  return (
    <Suspense fallback={<Loading label="Открываем планёрку…" />}>
      <SessionView />
    </Suspense>
  );
}

function SessionView() {
  const params = useSearchParams();
  const raw = params.get('d');
  const heldOn = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayISO();
  const isToday = heldOn === todayISO();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-8 sm:px-6 md:pt-12">
      <PageHeader
        eyebrow={isToday ? 'Сегодня' : undefined}
        title={`Планёрка ${fmt(heldOn, 'd MMMM')}`}
        back={{ href: '/planerka', label: 'Планёрки' }}
      />
      <PlanerkaSession heldOn={heldOn} />
    </div>
  );
}
