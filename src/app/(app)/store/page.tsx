'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, Loader2, Plus, X } from 'lucide-react';
import supabase from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

interface ShopItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cost_points: number;
  is_claimed: boolean;
  claimed_by: string | null;
}

export default function StorePage() {
  const { user, spaceId } = useSpaceAuth();

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
    setIsLoading(true);

    const [itemsResult, ledgerResult] = await Promise.all([
      supabase
        .from('shop_items')
        .select('id, user_id, title, description, cost_points, is_claimed, claimed_by')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false }),
      supabase.from('points_ledger').select('to_user, amount').eq('space_id', spaceId),
    ]);

    setItems((itemsResult.data ?? []) as ShopItem[]);

    const earned = (ledgerResult.data ?? [])
      .filter((row) => row.to_user === user.id)
      .reduce((sum, row) => sum + row.amount, 0);
    setBalance(earned);

    /* A dropped ledger error would render a confident, wrong balance of 0. */
    setError(
      itemsResult.error || ledgerResult.error
        ? 'Не удалось загрузить услуги и баллы. Проверьте связь и обновите страницу.'
        : null,
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
      setError(saveError.message);
      return;
    }
    setTitle('');
    setDescription('');
    setCost(5);
    setComposing(false);
    await load();
  };

  const request = async (item: ShopItem) => {
    if (!user || !spaceId || claiming) return;
    if (balance < item.cost_points) return;

    setClaiming(item.id);

    /*
      The guarded update is the lock: `select` tells us how many rows it actually
      touched, so a double click claims nothing twice and never writes a second
      ledger row.
    */
    const { data: claimed, error: claimError } = await supabase
      .from('shop_items')
      .update({ is_claimed: true, claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('is_claimed', false)
      .select('id');

    if (claimError) {
      setClaiming(null);
      setError('Не получилось попросить об услуге. Попробуйте ещё раз.');
      return;
    }

    if (!claimed || claimed.length === 0) {
      setClaiming(null);
      setError('Об этой услуге уже попросили.');
      await load();
      return;
    }

    /* The cost comes off the requester's own balance, not the provider's. */
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
      setError('Баллы не списались, услуга осталась свободной. Попробуйте ещё раз.');
    }

    setClaiming(null);
    await load();
  };

  const theirs = items.filter((item) => item.user_id !== user?.id);
  const mine = items.filter((item) => item.user_id === user?.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8 md:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Услуги</h1>
          <p className="mt-1 text-sm text-ink-faint">
            То, что вы готовы сделать друг для друга.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-2.5 shadow-card">
          <span className="text-sm text-ink-faint">У вас</span>{' '}
          <span className="font-semibold">{balance}</span>{' '}
          <span className="text-sm text-ink-soft">баллов</span>
        </div>
      </header>

      {composing ? (
        <section className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold">Что вы готовы сделать</h2>
            <button
              type="button"
              onClick={() => setComposing(false)}
              aria-label="Закрыть"
              className="tap flex items-center justify-center rounded-lg text-ink-faint hover:bg-sunken hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="space-y-4">
            <input
              aria-label="Название"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: массаж плеч без разговоров"
              className="h-11 w-full rounded-lg border border-line bg-sunken px-3.5 text-base outline-none focus:border-accent focus:bg-surface"
            />
            <textarea
              aria-label="Описание"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Подробности, если нужны"
              className="w-full resize-y rounded-xl border border-line bg-sunken p-3.5 text-[15px] outline-none focus:border-accent focus:bg-surface"
            />
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Сколько это стоит баллов</span>
              <input
                type="number"
                min={1}
                max={100}
                value={cost}
                onChange={(event) => setCost(Math.max(1, Number(event.target.value)))}
                className="h-11 w-28 rounded-lg border border-line bg-sunken px-3.5 text-base outline-none focus:border-accent focus:bg-surface"
              />
            </label>
            <Button loading={busy} disabled={!title.trim()} onClick={offer}>
              Предложить
            </Button>
          </div>
        </section>
      ) : (
        <Button className="mb-6" onClick={() => setComposing(true)}>
          <Plus className="size-4" aria-hidden /> Предложить услугу
        </Button>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-ink-faint">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm">Загружаем…</span>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-semibold">Что предлагает партнёр</h2>
            {theirs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center">
                <Gift className="mx-auto size-7 text-ink-faint" aria-hidden />
                <p className="mt-3 text-sm text-ink-soft">
                  Пока пусто. Можно предложить партнёру то, что хотелось бы здесь видеть.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {theirs.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{item.title}</p>
                        {item.description && (
                          <p className="mt-1 text-sm text-ink-soft">{item.description}</p>
                        )}
                        <p className="mt-1 text-sm text-ink-faint">{item.cost_points} баллов</p>
                      </div>
                      {item.is_claimed ? (
                        <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-ink-soft">
                          Уже попросили
                        </span>
                      ) : (
                        <Button
                          disabled={balance < item.cost_points}
                          loading={claiming === item.id}
                          onClick={() => request(item)}
                        >
                          Попросить
                        </Button>
                      )}
                    </div>
                    {!item.is_claimed && balance < item.cost_points && (
                      <p className="mt-3 text-sm text-ink-faint">
                        Не хватает {item.cost_points - balance} баллов.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-semibold">Что предлагаете вы</h2>
            {mine.length === 0 ? (
              <p className="text-sm text-ink-faint">Вы пока ничего не предложили.</p>
            ) : (
              <ul className="space-y-3">
                {mine.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                    <p className="font-medium">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 text-sm text-ink-soft">{item.description}</p>
                    )}
                    <p className="mt-1 text-sm text-ink-faint">
                      {item.cost_points} баллов
                      {item.is_claimed && ' · партнёр попросил об этом'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}
