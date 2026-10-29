'use client';

import { useState } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';

/* The invite code with the shortest path to the partner's phone: the system share sheet. */
export function InviteCard({ compact = false }: { compact?: boolean }) {
  const { inviteCode, getInviteUrl } = useSpaceAuth();
  const [copied, setCopied] = useState(false);
  if (!inviteCode) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the code is on screen to copy by hand */
    }
  };

  const share = async () => {
    const url = getInviteUrl();
    if (!url) return;
    const text = 'Заходи ко мне во Впаре — это наше общее пространство на каждый день.';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Впаре', text, url });
        return;
      } catch {
        /* the sheet was dismissed; fall through to copying */
      }
    }
    await copy(url);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
      <h2 className="font-semibold">Код приглашения</h2>
      <p className="mt-1.5 text-sm text-ink-soft">
        {compact
          ? 'Отправьте его партнёру, чтобы он вошёл в ваше пространство.'
          : 'Отправьте ссылку любым способом — партнёр сразу окажется в вашем пространстве.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-sunken px-3.5 py-2.5 text-center text-base tracking-wide">
          {inviteCode}
        </code>
        <Button variant="secondary" onClick={() => copy(inviteCode)}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? 'Скопировано' : 'Копировать'}
        </Button>
      </div>
      {!compact && (
        <div className="mt-3">
          <Button size="lg" block onClick={share}>
            <Send className="size-4.5" aria-hidden /> Отправить партнёру
          </Button>
        </div>
      )}
    </section>
  );
}
