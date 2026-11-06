'use client';

import Link from 'next/link';

export interface SubItem {
  href: string;
  label: string;
}

/*
  Sub-navigation for a section that holds more than one screen. The top level is
  four tabs; this is where the screens under a tab become visible, so nothing is
  hidden behind a «Ещё» list. Links, not buttons: each one is a real destination.

  Phone only. The desktop rail already nests the same links under the open
  section, so showing this bar there would state the same thing twice.
*/
export function SectionTabs({
  items,
  pathname,
  badges,
}: {
  items: SubItem[];
  pathname: string;
  badges?: Record<string, number>;
}) {
  return (
    <nav
      aria-label="Разделы внутри вкладки"
      className="safe-t sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur-sm md:hidden"
    >
      <ul className="flex gap-1 overflow-x-auto px-5 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const badge = badges?.[href] ?? 0;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`tap relative flex items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? 'border-accent text-ink'
                    : 'border-transparent text-ink-soft hover:text-ink'
                }`}
              >
                <span className="px-2">{label}</span>
                {badge > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] leading-none font-semibold text-accent-ink">
                    {badge > 9 ? '9+' : badge}
                    <span className="sr-only"> новых</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
