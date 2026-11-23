'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { tr } from '@/lib/i18n';

/*
  A sheet from the bottom for things set once and then left alone (when the
  couple meets, the important dates): the same curve as the island. Esc, the
  scrim or the cross put it away.
*/
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => panel.current?.focus());
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const transition = reduce ? { duration: 0 } : { duration: 0.55, ease: [0.32, 0.72, 0, 1] as const };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={onClose}
            className="absolute inset-0"
            style={{ backgroundColor: 'var(--c-scrim)' }}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={transition}
            className="relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[1.75rem] bg-surface px-5 pt-4 outline-none"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)', boxShadow: 'var(--sh-lift)' }}
          >
            <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <h2 className="text-title-3 font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={tr('Закрыть', 'Close')}
                className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-soft hover:text-ink"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
