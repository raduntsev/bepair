'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react';
import supabase from '@/lib/supabase';
import { DATE_QUESTION, QUESTIONS } from '@/lib/questions';
import { todayISO } from '@/lib/dates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Alert } from '@/components/ui/Blocks';
import { InviteCard } from '@/components/InviteCard';
import { Centered } from '@/components/AuthScreens';
import { ReminderSettings } from '@/components/ReminderSettings';
import { useReminders } from '@/hooks/useReminders';
import { tr } from '@/lib/i18n';

const TOTAL = QUESTIONS.length;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, spaceId, partner, settings, profile, updateProfile, refreshSettings } = useSpaceAuth();
  const reduce = useReducedMotion();

  /* Step 0 is the introduction — a name and how to write about you — before the eight questions. */
  const [step, setStep] = useState(profile?.display_name?.trim() && profile?.gender ? 1 : 0);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [gender, setGender] = useState<'m' | 'f' | null>(profile?.gender ?? null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [askReminders, setAskReminders] = useState(false);

  /* Coming back later: start from what was already said. */
  useEffect(() => {
    if (!user) return;
    supabase
      .from('couple_answers')
      .select('question, answer')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const next: Record<number, string> = {};
        for (const row of data ?? []) next[row.question as number] = row.answer as string;
        if (!next[DATE_QUESTION] && settings?.together_since) next[DATE_QUESTION] = settings.together_since;
        setAnswers((current) => ({ ...next, ...current }));
      });
  }, [user, settings?.together_since]);

  const value = answers[step] ?? '';

  const finish = async () => {
    if (!profile?.onboarded_at) await updateProfile({ onboarded_at: new Date().toISOString() });
    setAskReminders(true);
  };

  const introduce = async () => {
    setError(null);
    setBusy(true);
    const ok = await updateProfile({ display_name: name.trim(), ...(gender ? { gender } : {}) });
    setBusy(false);
    if (!ok) {
      setError(tr('Не получилось сохранить имя. Попробуйте ещё раз.', 'Couldn’t save the name. Please try again.'));
      return;
    }
    setStep(1);
  };

  const advance = async (save: boolean) => {
    setError(null);
    if (save && value.trim() && user && spaceId) {
      setBusy(true);
      const { error: saveError } = await supabase
        .from('couple_answers')
        .upsert(
          { user_id: user.id, space_id: spaceId, question: step, answer: value.trim(), updated_at: new Date().toISOString() },
          { onConflict: 'user_id,question' },
        );
      if (!saveError && step === DATE_QUESTION) {
        await supabase.rpc('bp_set_together_since', { d: value });
        await refreshSettings();
      }
      setBusy(false);
      if (saveError) {
        setError(tr('Ответ не сохранился. Попробуйте ещё раз или пропустите вопрос.', 'The answer wasn’t saved. Try again or skip the question.'));
        return;
      }
    }
    if (step === TOTAL) await finish();
    else setStep(step + 1);
  };

  if (askReminders && !done) return <RemindersStep onDone={() => setDone(true)} />;

  if (done) {
    return (
      <Centered>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{tr('Всё готово', 'All set')}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {partner
              ? tr(`${partner.display_name || 'Партнёр'} уже здесь. Можно отмечать первый общий день.`, `${partner.display_name || 'Your partner'} is already here. You can mark your first day together.`)
              : tr('Осталось позвать партнёра. Без него пространство работает, но смысла в нём немного.', 'All that’s left is to invite your partner. The space works without them, but there isn’t much point.')}
          </p>
        </div>
        {!partner && <InviteCard />}
        <div className="mt-4 flex justify-center">
          <Button variant={partner ? 'primary' : 'ghost'} size={partner ? 'lg' : 'md'} onClick={() => router.replace('/day')}>
            {partner ? tr('Открыть день', 'Open the day') : tr('Позже', 'Later')}
          </Button>
        </div>
      </Centered>
    );
  }

  if (step === 0) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-10">
        <p className="text-sm text-ink-faint">{tr('Знакомство', 'Getting started')}</p>
        <h1 className="mt-2 text-2xl leading-snug font-semibold tracking-tight md:text-3xl">{tr('Как вас зовут?', 'What’s your name?')}</h1>
        <p className="mt-3 text-sm text-ink-faint">{tr('Это имя увидит партнёр. Поменять можно в настройках.', 'Your partner will see this name. You can change it in settings.')}</p>
        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) introduce();
          }}
        >
          <Input aria-label={tr('Имя', 'Name')} autoComplete="given-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={tr('Имя', 'Name')} />
          <div>
            <p className="mb-2 text-sm font-medium">{tr('О себе', 'About you')}</p>
            <Segment
              legend={tr('Как о вас писать', 'How to address you')}
              options={[
                { value: 'f' as const, label: tr('Я женщина', 'She') },
                { value: 'm' as const, label: tr('Я мужчина', 'He') },
              ]}
              value={gender}
              onChange={setGender}
            />
            <p className="mt-2 text-sm text-ink-faint">{tr('Чтобы уведомления партнёру звучали по-человечески. Можно не выбирать.', 'So notifications to your partner read naturally. Optional.')}</p>
          </div>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" block loading={busy} disabled={!name.trim()}>
            {tr('Дальше', 'Next')} <ArrowRight className="size-5" aria-hidden />
          </Button>
        </form>
      </div>
    );
  }

  const isDate = step === DATE_QUESTION;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-10 md:pt-12">
      <div className="mb-10 flex items-center gap-3">
        <button
          type="button"
          aria-label={step > 1 ? tr('Предыдущий вопрос', 'Previous question') : tr('К имени', 'Back to name')}
          onClick={() => setStep(step - 1)}
          className="tap flex items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-sunken hover:text-ink disabled:opacity-30"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL}
          aria-valuenow={step}
          aria-label={tr('Вопросы', 'Questions')}
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out-soft" style={{ width: `${(step / TOTAL) * 100}%` }} />
        </div>
        <span className="w-10 text-right text-xs tabular-nums text-ink-faint">
          {step} / {TOTAL}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-1 flex-col"
        >
          <p className="text-sm text-ink-faint">
            {tr(`Вопрос ${step} из ${TOTAL}`, `Question ${step} of ${TOTAL}`)}
          </p>
          <h1 className="mt-2 text-2xl leading-snug font-semibold tracking-tight md:text-3xl">{QUESTIONS[step - 1]}</h1>
          <p className="mt-3 text-sm text-ink-faint">
            {isDate
              ? tr('С этого дня мы посчитаем, сколько вы вместе. Дату можно поменять в профиле пары.', 'We’ll count your days together from this date. You can change it in your couple profile.')
              : tr('Ответ увидит только партнёр. Пропустить можно любой вопрос.', 'Only your partner will see the answer. Any question can be skipped.')}
          </p>

          <div className="mt-6">
            {isDate ? (
              <Input
                type="date"
                aria-label={QUESTIONS[step - 1]}
                max={todayISO()}
                value={value}
                onChange={(event) => setAnswers({ ...answers, [step]: event.target.value })}
              />
            ) : (
              <Textarea
                aria-label={QUESTIONS[step - 1]}
                rows={5}
                value={value}
                onChange={(event) => setAnswers({ ...answers, [step]: event.target.value })}
                placeholder={tr('Напишите как есть — коротко тоже годится.', 'Write it as it is — short is fine.')}
              />
            )}
          </div>

          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <Button size="lg" block loading={busy} disabled={!value.trim()} onClick={() => advance(true)}>
              {step === TOTAL ? (
                <>
                  <Check className="size-5" aria-hidden /> {tr('Завершить', 'Finish')}
                </>
              ) : (
                <>
                  {tr('Дальше', 'Next')} <ArrowRight className="size-5" aria-hidden />
                </>
              )}
            </Button>
            <Button variant="ghost" block disabled={busy} onClick={() => advance(false)}>
              {tr('Пропустить', 'Skip')}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/*
  The quick setup the concept asks for right after sign-up: two reminders with
  sensible defaults already on. «Настрою позже» is an equal path, not an escape
  hatch — skipping keeps the defaults, so nothing is lost.
*/
function RemindersStep({ onDone }: { onDone: () => void }) {
  const { reminders, available, error, update } = useReminders();

  /* Before migration 0004 there is nothing to set up: go straight on. */
  useEffect(() => {
    if (!available) onDone();
  }, [available, onDone]);

  if (!available || !reminders) return null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-10">
      <p className="text-sm text-ink-faint">{tr('Последний шаг', 'Last step')}</p>
      <h1 className="mt-2 text-2xl leading-snug font-semibold tracking-tight md:text-3xl">{tr('Когда напоминать?', 'When to remind you?')}</h1>
      <p className="mt-3 text-sm text-ink-faint">
        {tr('Только когда есть повод и не чаще раза в день. Поменять можно в любой момент в настройках уведомлений.', 'Only when there’s a reason, and at most once a day. You can change it any time in notification settings.')}
      </p>
      <div className="mt-6">
        <ReminderSettings value={reminders} onChange={update} />
      </div>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={onDone}>
          {tr('Готово', 'Done')} <ArrowRight className="size-4" aria-hidden />
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {tr('Настрою позже', 'I’ll set it later')}
        </Button>
      </div>
    </div>
  );
}
