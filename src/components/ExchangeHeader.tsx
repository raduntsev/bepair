'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { plural } from '@/lib/dates';

/*
  «Просьбы» and «Услуги» are one mechanic — ask, do, earn, spend — so they are
  one section with two tabs, and the balance that ties them sits over both.
*/
const TABS = [
  { href: '/tasks', label: 'Просьбы' },
  { href: '/store', label: 'Услуги' },
];

function useBalance(given?: number) {
  const { user, spaceId } = useSpaceAuth();
  const [fetched, setFetched] = useState<number | null>(null);
  useEffect(() => {
    if (given !== undefined || !user || !spaceId) return;
    let alive = true;
    supabase
      .from('points_ledger')
      .select('to_user, amount')
      .eq('space_id', spaceId)
      .then(({ data, error }) => {
        if (!alive || error) return;
        setFetched((data ?? []).filter((r) => r.to_user === user.id).reduce((sum, r) => sum + r.amount, 0));
      });
    return () => {
      alive = false;
    };
  }, [given, user, spaceId]);
  return given ?? fetched;
}

export function ExchangeHeader({ current, balance }: { current: '/tasks' | '/store'; balance?: number }) {
  const value = useBalance(balance);

  return (
    <header className="mb-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-large-title font-bold">Просьбы</h1>
        {value !== null && (
          <p className="flex items-baseline gap-1 rounded-full bg-accent-soft px-3.5 py-1.5 text-accent-soft-ink" role="status">
            <span className="text-headline font-semibold tabular-nums">{value}</span>
            <span className="text-footnote">{plural(value, 'балл', 'балла', 'баллов')}</span>
          </p>
        )}
      </div>

      <nav aria-label="Просьбы и услуги" className="mt-4 flex rounded-xl bg-sunken p-1">
        {TABS.map(({ href, label }) => {
          const active = href === current;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-10 flex-1 items-center justify-center rounded-[0.625rem] text-subhead font-medium transition-colors duration-300 ${
                active ? 'text-ink' : 'text-ink-faint hover:text-ink'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="exchange-tab"
                  transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute inset-0 rounded-[0.625rem] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.04)]"
                />
              )}
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
