'use client';

import { useState } from 'react';
import { Download, FileText, LogOut, Trash2 } from 'lucide-react';
import { displayName, genitive } from '@/lib/words';
import { tr } from '@/lib/i18n';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert, LinkRow, Page, PageHeader, RowGroup } from '@/components/ui/Blocks';
import { PartnerLeftCard } from '@/components/PartnerLeft';
import { ResetSpace } from '@/components/ResetSpace';

/*
  The two ways out, each one person's own decision — no consent asked, because
  nobody should be held in a pair or an account by someone else.

  Leaving: the shared history stays with the partner, the space closes so no
  third person can ever read it, the location stops at once.
  Deleting: everything the person wrote goes, and the account with it.

  This page is also the web address a store listing gives for account deletion.
*/
export default function AccountPage() {
  const { partner, hasSpace, closedSpace } = useSpaceAuth();
  const name = displayName(partner?.display_name);

  return (
    <Page width="form">
      <PageHeader title={tr('Аккаунт', 'Account')} back={{ href: '/settings', label: tr('Профиль', 'Profile') }} />

      <div className="space-y-6">
        {closedSpace && <PartnerLeftCard compact />}

        <RowGroup
          label={tr('Ваши данные', 'Your data')}
          footer={tr('Перед уходом можно сохранить всё, что вы написали, одним файлом.', 'Before you go, you can save everything you wrote as one file.')}
        >
          <LinkRow href="/settings/personal" Icon={Download} title={tr('Скачать мои данные', 'Download my data')} />
        </RowGroup>

        <RowGroup label={tr('Документы', 'Documents')}>
          <LinkRow href="/privacy" Icon={FileText} title={tr('Политика обработки данных', 'Privacy policy')} />
          <LinkRow href="/consent" Icon={FileText} title={tr('Согласие на обработку данных', 'Consent to data processing')} />
          <LinkRow href="/consent/health" Icon={FileText} title={tr('Согласие на сведения о здоровье', 'Consent to health data')} />
        </RowGroup>

        {partner && <LeavePair name={name} gender={partner.gender} />}

        {/* Alone — the partner left, or never came: the space itself can go, at once. */}
        {hasSpace && !partner && <ResetSpace />}

        <DeleteAccount partnerName={partner ? name : null} alone={hasSpace && !partner} />
      </div>
    </Page>
  );
}

function LeavePair({ name, gender }: { name: string; gender: 'm' | 'f' | null | undefined }) {
  const { leaveSpace } = useSpaceAuth();
  const genitiveName = name === tr('Партнёр', 'Partner') ? 'партнёра' : genitive(name, gender);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    setError(null);
    const ok = await leaveSpace();
    /* On success the gate takes over: no space, so it offers to start a new one. */
    if (!ok) {
      setError(tr('Не получилось. Проверьте связь и попробуйте ещё раз.', 'That didn’t work. Check your connection and try again.'));
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card" aria-labelledby="leave-title">
      <h2 id="leave-title" className="text-headline font-semibold">
        {tr('Выйти из пары', 'Leave the pair')}
      </h2>
      <p className="mt-1.5 text-sm text-ink-soft">
        {tr(
          `Это решаете только вы — согласие партнёра не нужно. Ваше место на карте исчезнет сразу, а новые дни и весточки ${name} больше не увидит. То, что вы уже отправили, останется у партнёра. Вернуться в это пространство будет нельзя, но можно начать новое.`,
          `This is yours alone to decide — no consent needed. Your place on the map disappears at once, and ${name} won’t see any new days or notes. What you already sent stays with them. You can’t come back to this space, but you can start a new one.`,
        )}
      </p>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}

      {confirming ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-ink">
            {tr(`${name} получит уведомление, что вы вышли.`, `${name} will be told that you left.`)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" loading={busy} onClick={leave}>
              <LogOut className="size-4" aria-hidden /> {tr('Выйти из пары', 'Leave the pair')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              {tr('Остаться', 'Stay')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            <LogOut className="size-4" aria-hidden /> {tr('Выйти из пары', 'Leave the pair')}
          </Button>
          <p className="mt-2 text-footnote text-ink-faint">
            {tr(`Ваша общая история останется у ${genitiveName}.`, `${name} keeps your shared history.`)}
          </p>
        </div>
      )}
    </section>
  );
}

function DeleteAccount({ partnerName, alone }: { partnerName: string | null; alone: boolean }) {
  const { deleteAccount } = useSpaceAuth();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const word = tr('удалить', 'delete');
  const ready = typed.trim().toLowerCase() === word;

  const run = async () => {
    setBusy(true);
    setError(null);
    const ok = await deleteAccount();
    if (!ok) {
      setError(tr('Не получилось удалить. Проверьте связь и попробуйте ещё раз — уже удалённое не вернётся, остальное удалится со второй попытки.', 'Couldn’t delete. Check your connection and try again — whatever is already gone stays gone, the rest goes on the next try.'));
      setBusy(false);
    }
  };

  const what = partnerName
    ? tr(
        `Удалятся ваш профиль и всё, что вы написали: дни, письма, весточки, журнал, ответы курсов, фото и файлы. Вы выйдете из пары, ${partnerName} получит уведомление и сохранит свои собственные записи. Вернуть ничего будет нельзя.`,
        `Your profile and everything you wrote goes: days, letters, notes, journal, course answers, photos and files. You leave the pair; ${partnerName} is told and keeps what they wrote. Nothing can be brought back.`,
      )
    : alone
      ? tr(
          'Удалятся ваш профиль и всё пространство целиком: дни, письма, весточки, журнал, ответы курсов, фото и файлы. Вернуть ничего будет нельзя.',
          'Your profile goes, and the whole space with it: days, letters, notes, journal, course answers, photos and files. Nothing can be brought back.',
        )
      : tr('Удалятся ваш профиль и всё, что с ним связано. Вернуть ничего будет нельзя.', 'Your profile and everything tied to it goes. Nothing can be brought back.');

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title" className="text-headline font-semibold text-danger">
        {tr('Удалить аккаунт', 'Delete account')}
      </h2>
      <p className="mt-1.5 text-sm text-ink-soft">{what}</p>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}

      {confirming ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block text-ink-soft">{tr(`Чтобы подтвердить, напишите «${word}»`, `To confirm, type “${word}”`)}</span>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="none" autoComplete="off" spellCheck={false} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" loading={busy} disabled={!ready} onClick={run}>
              <Trash2 className="size-4" aria-hidden /> {tr('Удалить навсегда', 'Delete for good')}
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
      ) : (
        <div className="mt-4">
          <Button variant="danger" onClick={() => setConfirming(true)}>
            <Trash2 className="size-4" aria-hidden /> {tr('Удалить аккаунт', 'Delete account')}
          </Button>
        </div>
      )}
    </section>
  );
}
