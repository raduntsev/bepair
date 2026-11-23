'use client';

import { useCallback, useEffect, useState } from 'react';
import { MoreHorizontal, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import supabase from '@/lib/supabase';
import { points } from '@/lib/dates';
import { displayName, genitive, verb } from '@/lib/words';
import { flushPush } from '@/lib/push';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Alert, Loading, Page } from '@/components/ui/Blocks';
import { AutoHeight } from '@/components/ui/AutoHeight';
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

const ITEM_COLUMNS = 'id, user_id, title, description, cost_points, is_claimed, claimed_by, claimed_at';

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
        .select(ITEM_COLUMNS)
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
    const { data: saved, error: saveError } = await supabase
      .from('shop_items')
      .insert({
        space_id: spaceId,
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        cost_points: cost,
      })
      .select(ITEM_COLUMNS)
      .single();
    setBusy(false);
    if (saveError || !saved) {
      setError(tr('Услуга не сохранилась. Попробуйте ещё раз.', 'The favour wasn’t saved. Please try again.'));
      return;
    }
    setTitle('');
    setDescription('');
    setCost(5);
    setComposing(false);
    setItems((list) => [saved as ShopItem, ...list]);
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
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, is_claimed: true, claimed_by: user.id } : i)));
      setBalance((b) => b - item.cost_points);
      flushPush();
    }

    setClaiming(null);
  };

  const reoffer = async (item: ShopItem) => {
    const { error: reofferError } = await supabase.from('shop_items').update({ is_claimed: false, claimed_by: null, claimed_at: null }).eq('id', item.id);
    if (!reofferError) setItems((list) => list.map((i) => (i.id === item.id ? { ...i, is_claimed: false, claimed_by: null, claimed_at: null } : i)));
  };

  const withdraw = async (item: ShopItem) => {
    const { error: removeError } = await supabase.from('shop_items').delete().eq('id', item.id).eq('is_claimed', false);
    if (removeError) setError(tr('Не удалось убрать услугу.', 'Couldn’t remove the favour.'));
    else setItems((list) => list.filter((i) => i.id !== item.id));
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
            <h2 className="mb-2 px-1 text-subhead font-semibold text-ink-faint">
              {partner ? tr(`От ${genitive(name, partner.gender)}`, `From ${name}`) : tr('От партнёра', 'From your partner')}
            </h2>
            {theirs.length === 0 ? (
              <p className="rounded-2xl bg-surface px-4 py-3.5 text-subhead text-ink-faint shadow-card">
                {tr(`${name} пока ничего не ${verb(partner?.gender, 'предложил')}`, `${name} hasn’t offered anything yet`)}
              </p>
            ) : (
              <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line">
                {theirs.map((item) => (
                  <li key={item.id} className="flex min-h-13 items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className={`block text-body ${item.is_claimed ? 'text-ink-faint' : 'text-ink'}`}>{item.title}</span>
                      {item.description && <span className="line-clamp-2 block text-footnote text-ink-faint">{item.description}</span>}
                    </span>
                    {item.is_claimed ? (
                      <span className="shrink-0 text-footnote text-ink-faint">
                        {item.claimed_by === user?.id ? tr('вы попросили', 'you asked') : tr('уже попросили', 'already asked')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={balance < item.cost_points || claiming !== null}
                        onClick={() => request(item)}
                        aria-label={tr(`Попросить «${item.title}» за ${points(item.cost_points)}`, `Ask for “${item.title}” for ${points(item.cost_points)}`)}
                        className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-accent-soft px-3 text-footnote font-semibold text-accent-soft-ink tabular-nums transition-opacity active:opacity-70 disabled:opacity-40"
                      >
                        {claiming === item.id ? '…' : tr('Попросить', 'Ask')} · {item.cost_points}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <h2 className="text-subhead font-semibold text-ink-faint">{tr('От вас', 'From you')}</h2>
              {!composing && (
                <button type="button" onClick={() => setComposing(true)} className="tap -my-2 flex items-center gap-1 text-subhead font-semibold text-accent">
                  <Plus className="size-4" aria-hidden /> {tr('Предложить', 'Offer')}
                </button>
              )}
            </div>
            {mine.length === 0 ? null : (
              <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line">
                {mine.map((item) => (
                  <MyFavour
                    key={item.id}
                    item={item}
                    claimedLine={tr(`${name} ${verb(partner?.gender, 'попросил')}`, `${name} asked`)}
                    onReoffer={() => reoffer(item)}
                    onWithdraw={() => withdraw(item)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}

/* Your own offer: one line, and its one rare action behind «⋯». A claimed one shows who asked and «Сделано». */
function MyFavour({
  item,
  claimedLine,
  onReoffer,
  onWithdraw,
}: {
  item: ShopItem;
  claimedLine: string;
  onReoffer: () => Promise<void>;
  onWithdraw: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    await action();
    setBusy(false);
    setOpen(false);
  };

  return (
    <li>
      <div className="flex min-h-13 items-center gap-3 px-4 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-body">{item.title}</span>
          <span className="line-clamp-2 block text-footnote text-ink-faint">
            {item.is_claimed ? <span className="font-medium text-partner-ink">{claimedLine}</span> : points(item.cost_points)}
            {item.description && ` · ${item.description}`}
          </span>
        </span>
        {item.is_claimed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onReoffer)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-footnote font-semibold text-accent-soft-ink transition-opacity active:opacity-70"
          >
            <RotateCcw className="size-3.5" aria-hidden /> {tr('Сделано', 'Done')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={tr(`Действия с «${item.title}»`, `Actions for “${item.title}”`)}
            className="tap -mr-2 flex shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        )}
      </div>
      <AutoHeight>
        {open && !item.is_claimed && (
          <div className="px-4 pb-3">
            <button type="button" disabled={busy} onClick={() => run(onWithdraw)} className="tap flex items-center gap-1.5 text-subhead font-medium text-danger">
              <Trash2 className="size-4" aria-hidden /> {tr('Убрать', 'Remove')}
            </button>
          </div>
        )}
      </AutoHeight>
    </li>
  );
}
