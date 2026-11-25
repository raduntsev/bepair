import 'server-only';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { moodHex, moodColorName, moodLevel, type MoodLevel } from './mood';
import { streaks } from './streak';
import { displayName, verb, type Gender } from './words';
import { fmt, plural, sentence } from './dates';
import { inLang, tr, trIn, type Lang } from '@/lib/i18n';

/*
  What a home-screen widget shows. Built on the server with the service role,
  so it must re-apply the reciprocity rule itself: the partner's colour and
  word appear only once the owner has marked today (or both switched the rule
  off). All wording is decided here, so the iOS and Android widgets render the
  same sentences and never need their own grammar.
*/

export interface WidgetSnapshot {
  v: 1;
  date: string;
  dateLabel: string;
  headline: string;
  sub: string;
  /* level drives the pair characters' pose on the widgets; null when unmarked, sealed or hidden. */
  me: { name: string; marked: boolean; color: string | null; label: string | null; level: MoodLevel | null };
  partner: { name: string; marked: boolean; unlocked: boolean; color: string | null; label: string | null; level: MoodLevel | null } | null;
  together: { days: number; label: string } | null;
  streak: { enabled: boolean; current: number; best: number; label: string };
  waiting: { letters: number; tasks: number };
  hideMood: boolean;
  updatedAt: string;
}

export function localDate(timezone: string | null) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function buildSnapshot(admin: SupabaseClient, userId: string): Promise<WidgetSnapshot | null> {
  const { data: me } = await admin
    .from('profiles')
    .select('id, space_id, display_name, gender, timezone, widget_hide_colors, lang')
    .eq('id', userId)
    .maybeSingle();
  if (!me) return null;

  const today = localDate(me.timezone);
  const hideMood = !!me.widget_hide_colors;
  const lang: Lang = me.lang === 'en' ? 'en' : 'ru';
  const myName = displayName(me.display_name, trIn(lang, 'Вы', 'You'));

  /* Text is composed in the owner's language; inLang blocks hold no await. */
  const base: WidgetSnapshot = inLang(lang, () => ({
    v: 1,
    date: today,
    dateLabel: sentence(fmt(today, 'EEEEEE, d MMMM')),
    headline: tr('Как прошёл день?', 'How was your day?'),
    sub: tr('Отметьте его цветом', 'Mark it with a colour'),
    me: { name: myName, marked: false, color: null, label: null, level: null },
    partner: null,
    together: null,
    streak: { enabled: true, current: 0, best: 0, label: '' },
    waiting: { letters: 0, tasks: 0 },
    hideMood,
    updatedAt: new Date().toISOString(),
  }));

  if (!me.space_id) {
    return { ...base, headline: trIn(lang, 'Создайте пространство', 'Create your space'), sub: trIn(lang, 'Откройте Впаре, чтобы начать', 'Open Bepair to begin') };
  }

  const since = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [partnerResult, settingsResult, entriesResult, lettersResult, forMeResult, doneResult] = await Promise.all([
    admin.from('profiles').select('id, display_name, gender').eq('space_id', me.space_id).neq('id', me.id).maybeSingle(),
    admin.from('space_settings').select('reveal_first, count_streak, together_since').eq('space_id', me.space_id).maybeSingle(),
    admin.from('day_entries').select('user_id, entry_date, mood').eq('space_id', me.space_id).gte('entry_date', since),
    admin.from('letters').select('id', { count: 'exact', head: true }).eq('recipient_id', me.id).not('delivered_at', 'is', null).eq('is_read', false),
    admin.from('checklist_items').select('id', { count: 'exact', head: true }).eq('space_id', me.space_id).neq('user_id', me.id).eq('is_completed', false),
    admin.from('checklist_items').select('id', { count: 'exact', head: true }).eq('space_id', me.space_id).eq('user_id', me.id).eq('is_completed', true).is('acknowledged_at', null),
  ]);

  const partner = partnerResult.data as { id: string; display_name: string; gender: Gender } | null;
  const settings = settingsResult.data as { reveal_first: boolean; count_streak: boolean; together_since: string | null } | null;
  const entries = (entriesResult.data ?? []) as { user_id: string; entry_date: string; mood: number }[];

  const mine = entries.find((e) => e.user_id === me.id && e.entry_date === today) ?? null;
  const theirs = partner ? entries.find((e) => e.user_id === partner.id && e.entry_date === today) ?? null : null;
  const revealFirst = settings?.reveal_first ?? true;
  const unlocked = !!mine || !revealFirst;

  const byDate = new Map<string, Set<string>>();
  for (const e of entries) byDate.set(e.entry_date, (byDate.get(e.entry_date) ?? new Set()).add(e.user_id));
  const both = new Set([...byDate].filter(([, users]) => users.size >= 2).map(([date]) => date));
  const run = streaks(both, today);

  const togetherDays = settings?.together_since
    ? differenceInCalendarDays(parseISO(today), parseISO(settings.together_since)) + 1
    : null;

  return inLang(lang, () => compose());

  function compose(): WidgetSnapshot {
  const show = (mood: number | undefined | null) => (mood == null || hideMood ? null : moodHex(mood));
  /* The colour's name, for screen readers on the widget — never a caption of what the day meant. */
  const word = (mood: number | undefined | null) => (mood == null || hideMood ? null : moodColorName(mood));
  const level = (mood: number | undefined | null) => (mood == null || hideMood ? null : moodLevel(mood));

  const snapshot: WidgetSnapshot = {
    ...base,
    me: { name: myName, marked: !!mine, color: show(mine?.mood), label: word(mine?.mood), level: level(mine?.mood) },
    together: togetherDays && togetherDays > 0 ? { days: togetherDays, label: tr(`${plural(togetherDays, 'день', 'дня', 'дней')} вместе`, `${togetherDays === 1 ? 'day' : 'days'} together`) } : null,
    streak: {
      enabled: settings?.count_streak ?? true,
      current: run.current,
      best: run.best,
      label: run.current > 0 ? tr(`${plural(run.current, 'день', 'дня', 'дней')} подряд`, `${run.current === 1 ? 'day' : 'days'} in a row`) : tr('серия впереди', 'the run is ahead'),
    },
    waiting: { letters: lettersResult.count ?? 0, tasks: (forMeResult.count ?? 0) + (doneResult.count ?? 0) },
  };

  if (!partner) {
    return { ...snapshot, headline: mine ? tr('День отмечен', 'Day marked') : tr('Как прошёл день?', 'How was your day?'), sub: tr('Позовите партнёра — код в настройках', 'Invite your partner — the code is in settings') };
  }

  const name = displayName(partner!.display_name);
  snapshot.partner = {
    name,
    marked: !!theirs,
    unlocked,
    color: unlocked ? show(theirs?.mood) : null,
    label: unlocked ? word(theirs?.mood) : null,
    level: unlocked ? level(theirs?.mood) : null,
  };

  if (!mine) {
    if (theirs && revealFirst) {
      snapshot.headline = tr(`${name} ${verb(partner!.gender, 'отметил')} день`, `${name} marked the day`);
      snapshot.sub = tr('Отметьте свой — и он откроется', 'Mark yours and it opens');
    } else {
      snapshot.headline = tr('Как прошёл день?', 'How was your day?');
      snapshot.sub = tr('Отметьте его цветом', 'Mark it with a colour');
    }
  } else if (!theirs) {
    snapshot.headline = tr(`${name} ещё не ${verb(partner!.gender, 'отметил')} день`, `${name} hasn’t marked the day yet`);
    snapshot.sub = tr('Ваш день отмечен', 'Your day is marked');
  } else {
    /* The colours speak for themselves: no word says what a day was. */
    snapshot.headline = tr(`${name} ${verb(partner!.gender, 'отметил')} день`, `${name} marked the day`);
    snapshot.sub = tr('Вы оба отметились', 'You both marked the day');
  }

  return snapshot;
  }
}
