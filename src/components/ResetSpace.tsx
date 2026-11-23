'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { flushPush } from '@/lib/push';
import { displayName, verb } from '@/lib/words';
import { tr } from '@/lib/i18n';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Blocks';

/*
  Deleting everything the two of you have, like a paired setting: one asks,
  the other agrees, and only then is it gone — days, letters, notes, requests,
  check-ins, photos, files. Both accounts stay, unlinked, free to start again.
  Typing the word is the brake against a stray tap; alone in the space there
  is nobody to ask, so it happens at once.
*/
export function ResetSpace() {
  const { user, partner, settings, refresh, refreshSettings } = useSpaceAuth();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = displayName(partner?.display_name);
  const word = tr('удалить', 'delete');
  const ready = typed.trim().toLowerCase() === word;
  const asked = settings?.pending_key === 'reset_space';
  const askedByMe = asked && settings?.pending_by === user?.id;
  const askedOfMe = asked && !askedByMe;

  const fail = () => setError(tr('Не получилось. Проверьте связь и попробуйте ещё раз.', 'That didn’t work. Check your connection and try again.'));

  /* The irreversible part runs on the server, which checks the agreement again. */
  const erase = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return fail();
    const response = await fetch('/api/space/reset', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return fail();
    await refresh();
    router.replace('/');
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      fail();
    }
    setBusy(false);
  };

  const propose = () =>
    run(async () => {
      const { data, error: rpcError } = await supabase.rpc('bp_propose_reset');
      if (rpcError) return fail();
      if (data === 'alone' || data === 'agreed') return erase();
      flushPush();
      setConfirming(false);
      setTyped('');
      await refreshSettings();
    });

  const decline = () =>
    run(async () => {
      const { error: rpcError } = await supabase.rpc('bp_answer_setting', { accept: false });
      if (rpcError) return fail();
      flushPush();
      await refreshSettings();
    });

  const withdraw = () =>
    run(async () => {
      const { error: rpcError } = await supabase.rpc('bp_withdraw_setting');
      if (rpcError) return fail();
      await refreshSettings();
    });

  const what = tr(
    'Дни, письма, весточки, просьбы и услуги, планёрки, важные даты, фото и все файлы. Вернуть их будет нельзя. Аккаунты останутся — каждый сможет начать заново.',
    'Days, letters, notes, requests and favours, check-ins, important dates, photos and every file. They can’t be brought back. Both accounts stay — each of you can start again.',
  );

  const confirmBlock = (label: string, onConfirm: () => void) => (
    <div className="mt-4 space-y-3">
      <label className="block text-sm">
        <span className="mb-1.5 block text-ink-soft">{tr(`Чтобы подтвердить, напишите «${word}»`, `To confirm, type “${word}”`)}</span>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="none" autoComplete="off" spellCheck={false} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" loading={busy} disabled={!ready} onClick={onConfirm}>
          <Trash2 className="size-4" aria-hidden /> {label}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setConfirming(false);
            setTyped('');
          }}
        >
          {tr('Отмена', 'Cancel')}
        </Button>
      </div>
    </div>
  );

  return (
    <section className="mt-8 rounded-2xl bg-surface p-5 shadow-card" aria-labelledby="reset-title">
      <h2 id="reset-title" className="text-headline font-semibold text-danger">
        {askedOfMe
          ? tr(`${name} ${verb(partner?.gender, 'предложил')} удалить все данные пары`, `${name} suggests deleting all of your shared data`)
          : tr('Удалить все данные пары', 'Delete all shared data')}
      </h2>
      <p className="mt-1.5 text-sm text-ink-soft">{what}</p>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}

      {askedByMe ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-faint">{tr(`Ждём согласия: ${name}`, `Waiting for ${name} to agree`)}</span>
          <Button variant="ghost" loading={busy} onClick={withdraw}>
            {tr('Отозвать', 'Withdraw')}
          </Button>
        </div>
      ) : askedOfMe ? (
        confirming ? (
          confirmBlock(tr('Удалить всё', 'Delete everything'), () => run(erase))
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
              {tr('Согласиться и удалить', 'Agree and delete')}
            </Button>
            <Button variant="secondary" loading={busy} onClick={decline}>
              {tr('Оставить всё как есть', 'Keep everything')}
            </Button>
          </div>
        )
      ) : confirming ? (
        confirmBlock(partner ? tr('Предложить удаление', 'Ask to delete') : tr('Удалить всё', 'Delete everything'), propose)
      ) : (
        <div className="mt-4">
          <Button variant="danger" disabled={busy || (asked && !askedOfMe)} onClick={() => setConfirming(true)}>
            <Trash2 className="size-4" aria-hidden /> {tr('Удалить все данные', 'Delete all data')}
          </Button>
          {partner && <p className="mt-2 text-footnote text-ink-faint">{tr(`Удаление произойдёт, когда ${name} согласится.`, `It happens once ${name} agrees.`)}</p>}
        </div>
      )}
    </section>
  );
}
