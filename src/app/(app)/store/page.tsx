'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import supabase from '@/lib/supabase';
import { points } from '@/lib/dates';
import { displayName, genitive, verb } from '@/lib/words';
import { flushPush } from '@/lib/push';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Alert, Chip, EmptyState, Loading, Page, SectionHeader } from '@/components/ui/Blocks';
import { ExchangeHeader } from '@/components/ExchangeHeader';
import { tr } from '@/lib/i18n';

interface ShopItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cost_points: number;
  is_claimed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
}

/* «Услуги», «Попросить», «Предложить услугу» — never «купить»: that reads as buying the partner. */
export default function StorePage() {
  const { user, spaceId, partner } = useSpaceAuth();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(5);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }

    const [itemsResult, ledgerResult] = await Promise.all([
      supabase
        .from('shop_items')
        .select('id, user_id, title, description, cost_points, is_claimed, claimed_by, claimed_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false }),
      supabase.from('points_ledger').select('to_user, amount').eq('space_id', spaceId),
    ]);

    if (!itemsResult.error) setItems((itemsResult.data ?? []) as ShopItem[]);
    if (!ledgerResult.error) {
      setBalance(
        (ledgerResult.data ?? []).filter((row) => row.to_user === user.id).reduce((sum, row) => sum + row.amount, 0),
      );
    }

    /* A dropped ledger error would render a confident, wrong balance of 0. */
    setError(
      itemsResult.error || ledgerResult.error ? tr('Не удалось загрузить услуги и баллы. Проверьте связь и обновите страницу.', 'Couldn’t load favours and points. Check your connection and reload.') : null,
    );
    setIsLoading(false);
  }, [user, spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const offer = async () => {
    if (!user || !spaceId || !title.trim()) return;
    setBusy(true);
    const { error: saveError } = await supabase.from('shop_items').insert({
      space_id: spaceId,
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      cost_points: cost,
    });
    setBusy(false);
    if (saveError) {
      setError(tr('Услуга не сохранилась. Попробуйте ещё раз.', 'The favour wasn’t saved. Please try again.'));
      return;
    }
    setTitle('');
    setDescription('');
    setCost(5);
    setComposing(false);
    await load();
  };

  const request = async (item: ShopItem) => {
    if (!user || !spaceId || claiming || balance < item.cost_points) return;
    setClaiming(item.id);

    /* The guarded update is the lock: a double tap claims nothing twice. */
    const { data: claimed, error: claimError } = await supabase
      .from('shop_items')
      .update({ is_claimed: true, claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('is_claimed', false)
      .select('id');

    if (claimError || !claimed || claimed.length === 0) {
      setClaiming(null);
      setError(claimError ? tr('Не получилось попросить об услуге. Попробуйте ещё раз.', 'Couldn’t ask for the favour. Please try again.') : tr('Об этой услуге уже попросили.', 'Someone already asked for this favour.'));
      await load();
      return;
    }

    const { error: ledgerError } = await supabase.from('points_ledger').insert({
      space_id: spaceId,
      from_user: user.id,
      to_user: user.id,
      amount: -item.cost_points,
      reason: 'service',
      reference: item.id,
    });

    if (ledgerError) {
      /* Never leave a claim standing that was not paid for. */
      await supabase.from('shop_items').update({ is_claimed: false, claimed_by: null, claimed_at: null }).eq('id', item.id);
      setError(tr('Баллы не списались, услуга осталась свободной. Попробуйте ещё раз.', 'Points weren’t spent; the favour is still free. Please try again.'));
    } else {
      setError(null);
      flushPush();
    }

    setClaiming(null);
    await load();
  };

  const reoffer = async (item: ShopItem) => {
    await supabase.from('shop_items').update({ is_claimed: false, claimed_by: null, claimed_at: null }).eq('id', item.id);
    await load();
  };

  const withdraw = async (item: ShopItem) => {
    const { error: removeError } = await supabase.from('shop_items').delete().eq('id', item.id).eq('is_claimed', false);
    if (removeError) setError(tr('Не удалось убрать услугу.', 'Couldn’t remove the favour.'));
    await load();
  };

  const theirs = items.filter((item) => item.user_id !== user?.id);
  const mine = items.filter((item) => item.user_id === user?.id);
  const name = displayName(partner?.display_name);

  return (
    <Page>
      <ExchangeHeader current="/store" balance={isLoading ? undefined : balance} />

      {composing ? (
        <section className="mb-6 rounded-2xl bg-surface p-5 shadow-card md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-headline font-semibold">{tr('Новая услуга', 'New favour')}</h2>
            <button
              type="button"
              onClick={() => setComposing(false)}
              aria-label={tr('Закрыть', 'Close')}
              className="tap flex items-center justify-center rounded-lg text-ink-faint hover:bg-sunken hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="space-y-4">
            <Input aria-label={tr('Название', 'Title')} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tr('Например: массаж плеч без разговоров', 'For example: a shoulder massage, no talking')} autoFocus />
            <Textarea aria-label={tr('Описание', 'Description')} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder={tr('Подробности, если нужны', 'Details, if needed')} />
            <label className="flex items-center justify-between gap-3 text-subhead">
              <span className="font-medium">{tr('Баллов', 'Points')}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={cost}
                onChange={(event) => setCost(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
                className="w-28"
              />
            </label>
            <Button loading={busy} disabled={!title.trim()} onClick={offer}>
              {tr('Предложить', 'Offer')}
            </Button>
          </div>
        </section>
      ) : null}

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {isLoading ? (
        <Loading label={tr('Загружаем услуги…', 'Loading favours…')} />
      ) : (
        <div className="space-y-8">
          <section>
            <SectionHeader title={partner ? tr(`От ${genitive(name, partner.gender)}`, `From ${name}`) : tr('От партнёра', 'From your partner')} />
            {theirs.length === 0 ? (
              <EmptyState title={tr('Пока пусто', 'Nothing yet')} variant="quiet" />
            ) : (
              <ul className="space-y-3">
                {theirs.map((item) => (
                  <li key={item.id} className="rounded-2xl bg-surface p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium">{item.title}</p>
                        {item.description && <p className="mt-1 text-sm text-ink-soft">{item.description}</p>}
                      </div>
                      {item.is_claimed ? (
                        <Chip>{item.claimed_by === user?.id ? tr('Вы попросили', 'You asked') : tr('Уже попросили', 'Already asked')}</Chip>
                      ) : (
                        <Button disabled={balance < item.cost_points} loading={claiming === item.id} onClick={() => request(item)}>
                          {tr('Попросить', 'Ask')} · {item.cost_points}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionHeader
              title={tr('От вас', 'From you')}
              action={
                !composing && (
                  <Button variant="ghost" className="!h-9 !px-3" onClick={() => setComposing(true)}>
                    <Plus className="size-4" aria-hidden /> {tr('Добавить', 'Add')}
                  </Button>
                )
              }
            />
            {mine.length === 0 ? null : (
              <ul className="space-y-3">
                {mine.map((item) => (
                  <li key={item.id} className="rounded-2xl bg-surface p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium">{item.title}</p>
                        {item.description && <p className="mt-1 text-sm text-ink-soft">{item.description}</p>}
                        <p className="mt-1 text-sm text-ink-faint">{points(item.cost_points)}</p>
                      </div>
                      {item.is_claimed ? (
                        <Chip tone="partner">
                          {tr(`${name} ${verb(partner?.gender, 'попросил')}`, `${name} asked`)}
                        </Chip>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.is_claimed ? (
                        <Button variant="secondary" onClick={() => reoffer(item)}>
                          <RotateCcw className="size-4" aria-hidden /> {tr('Сделано, предложить снова', 'Done, offer again')}
                        </Button>
                      ) : (
                        <Button variant="ghost" onClick={() => withdraw(item)}>
                          <Trash2 className="size-4" aria-hidden /> {tr('Убрать', 'Remove')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
