'use client';

import { useEffect, useState } from 'react';
import { Clock, Moon, Sunrise } from 'lucide-react';
import supabase from '@/lib/supabase';
import { relativeStamp, timeIn } from '@/lib/dates';
import { noticeText, type NoticeKind } from '@/lib/notices';
import { displayName, verb } from '@/lib/words';
import type { Partner } from '@/hooks/useSpaceAuth';
import { Card } from '@/components/ui/Blocks';

interface Rhythm {
  last_seen_at: string | null;
  timezone: string | null;
  remind_morning: boolean;
  remind_morning_at: string;
  remind_evening: boolean;
  remind_evening_at: string;
}

interface LastAction {
  kind: NoticeKind;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const hhmm = (value: string) => value.slice(0, 5).replace(/^0/, '');

/*
  «Когда партнёр обычно здесь» — a tool for agreeing, not a showcase. Every line
  is something that helps you pick a moment: when they last came in, what they
  last did for you, when their reminders arrive, what time it is for them.
  Nothing here is a count that could be dropped or compared.
*/
export function PartnerRhythm({ partner, showClock }: { partner: Partner; showClock: boolean }) {
  const [rhythm, setRhythm] = useState<Rhythm | null>(null);
  const [last, setLast] = useState<LastAction | null>(null);
  const name = displayName(partner.display_name);

  useEffect(() => {
    let alive = true;
    /* Before migration 0005 this returns an error; the card then shows only the last action. */
    supabase.rpc('bp_partner_rhythm').then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (alive && row) setRhythm(row as Rhythm);
    });
    /* Your own feed already holds what they did for you: reuse it, no new access needed. */
    supabase
      .from('notifications')
      .select('kind, payload, created_at')
      .eq('actor_id', partner.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setLast(data as LastAction);
      });
    return () => {
      alive = false;
    };
  }, [partner.id]);

  const lines: { Icon: typeof Clock; text: string }[] = [];
  if (showClock) {
    const clock = timeIn(partner.timezone ?? rhythm?.timezone);
    const at = partner.gender === 'f' ? 'у неё' : partner.gender === 'm' ? 'у него' : 'у партнёра';
    if (clock) lines.push({ Icon: Clock, text: `Сейчас ${at} ${clock}` });
  }
  if (rhythm) {
    const morning = rhythm.remind_morning ? `утром в ${hhmm(rhythm.remind_morning_at)}` : null;
    const evening = rhythm.remind_evening ? `вечером в ${hhmm(rhythm.remind_evening_at)}` : null;
    const both = [morning, evening].filter(Boolean).join(' и ');
    lines.push({ Icon: morning ? Sunrise : Moon, text: both ? `Напоминания приходят ${both}` : 'Напоминания выключены' });
  }

  const seen = rhythm?.last_seen_at ? relativeStamp(rhythm.last_seen_at) : null;

  return (
    <Card>
      <h2 className="font-semibold">{name}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {seen ? `${verb(partner.gender, 'Заходил')} ${/^\d/.test(seen) ? `сегодня в ${seen}` : seen}` : 'Когда партнёр обычно здесь'}
      </p>

      {last && (
        <p className="mt-3 text-sm">
          <span className="text-ink-faint">Последнее для вас: </span>
          {noticeText(last, name, partner.gender)}
          <span className="text-ink-faint"> · {relativeStamp(last.created_at)}</span>
        </p>
      )}

      {lines.length > 0 && (
        <ul className="mt-3 space-y-2">
          {lines.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-sm text-ink-soft">
              <Icon className="size-4 shrink-0" aria-hidden /> {text}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-sm text-ink-faint">Это чтобы выбрать удобный момент, а не чтобы проверять.</p>
    </Card>
  );
}
