'use client';

import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/*
  The app lives on the phone's home screen: that is where it opens instantly
  and, on iPhone, the only place push works. Hidden once installed.
*/
export function InstallCard() {
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios'>('hidden');
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setMode('ios');
      return;
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (mode === 'hidden') return null;

  return (
    <section className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <Smartphone className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Впаре на экране «Домой»</h2>
        {mode === 'ios' ? (
          <p className="mt-1.5 text-sm text-ink-soft">
            В Safari нажмите «Поделиться», затем «На экран Домой». Так приложение открывается сразу, а уведомления начинают приходить.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-ink-soft">Открывается одним касанием, как обычное приложение.</p>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={async () => {
                if (!deferred) return;
                await deferred.prompt();
                await deferred.userChoice;
                setDeferred(null);
                setMode('hidden');
              }}
            >
              Установить
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
