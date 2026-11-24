'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/*
  Height that follows its content on a spring. Used wherever a block changes
  what it holds in place — the day card folding from editor to summary — so the
  blocks under it slide instead of jumping. Measures, never scales: text inside
  is never stretched mid-motion.
*/
export function AutoHeight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 32 }}
      className={`overflow-hidden ${className}`}
    >
      {/* flow-root keeps the children's margins inside, so the measured height is the drawn one. */}
      <div ref={inner} className="flow-root">
        {children}
      </div>
    </motion.div>
  );
}
