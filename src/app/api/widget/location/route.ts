import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeWidget } from '@/lib/widgetAuth';
import { agoLabel, distanceLabel, distanceM, freshBattery, isStale, TOGETHER_M, type Battery } from '@/lib/location';
import { displayName } from '@/lib/words';
import { inLang, tr, trIn, type Lang } from '@/lib/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  The «Карта» widget and the Android location service.

  GET — the two points and one line about them, composed in the owner's
  language. The reciprocity rule is re-applied here (the service role sees
  everything): the partner's point comes only while both share.

  POST {lat, lng, accuracy?, at?, battery?, charging?} — the owner's own point
  (and the phone's charge, which rides with it), from the phone's
  location service, then the same answer as GET. Dropped, not stored, when the
  owner does not share; `sharing: false` in the answer tells the service to stop.
  POST {sharing: false} — switch sharing off from the phone's notification.
*/

interface Dot {
  lat: number;
  lng: number;
  initial: string;
  stale: boolean;
}

export interface MapPayload {
  v: 1;
  state: 'no-space' | 'no-partner' | 'off' | 'partner-off' | 'waiting' | 'ok';
  /* The owner's own switch: the service stops when this turns false. */
  sharing: boolean;
  title: string;
  line: string;
  me: Dot | null;
  partner: Dot | null;
  /* The partner's charge under the same rule; also folded into `title` («Аня · 84 %») for older APKs. */
  partnerBattery: Battery | null;
  updatedAt: string;
}

const initial = (name: string) => (name.trim()[0] ?? '·').toLocaleUpperCase();

async function build(admin: SupabaseClient, userId: string): Promise<MapPayload | null> {
  const { data: me } = await admin
    .from('profiles')
    .select('id, space_id, display_name, lang, share_location')
    .eq('id', userId)
    .maybeSingle();
  if (!me) return null;
  const lang: Lang = me.lang === 'en' ? 'en' : 'ru';
  const sharing = !!me.share_location;
  const updatedAt = new Date().toISOString();
  const base = { v: 1 as const, sharing, me: null, partner: null, partnerBattery: null, updatedAt };

  if (!me.space_id) {
    return { ...base, state: 'no-space', title: trIn(lang, 'Где мы', 'Where we are'), line: trIn(lang, 'Откройте Впаре, чтобы начать', 'Open Bepair to begin') };
  }

  const { data: partner } = await admin
    .from('profiles')
    .select('id, display_name, share_location')
    .eq('space_id', me.space_id)
    .neq('id', me.id)
    .maybeSingle();

  /* Both points under the rule, read before any wording: inLang blocks hold no await. */
  const mutual = sharing && !!partner?.share_location;
  const { data: rows } = mutual
    ? await admin.from('locations').select('user_id, lat, lng, recorded_at, battery, charging').in('user_id', [me.id, partner.id])
    : { data: [] as { user_id: string; lat: number; lng: number; recorded_at: string; battery: number | null; charging: boolean | null }[] };

  return inLang(lang, (): MapPayload => {
    const name = displayName(partner?.display_name);
    if (!partner) {
      return { ...base, state: 'no-partner' as const, title: tr('Где мы', 'Where we are'), line: tr('Позовите партнёра — код в настройках', 'Invite your partner — the code is in settings') };
    }
    if (!sharing) {
      return {
        ...base,
        state: 'off' as const,
        title: tr('Где мы', 'Where we are'),
        line: partner.share_location
          ? tr(`${name} делится местоположением — включите своё, чтобы видеть друг друга`, `${name} is sharing — turn yours on to see each other`)
          : tr('Включите «Где мы» в приложении — и увидите друг друга', 'Turn on “Where we are” in the app to see each other'),
      };
    }
    if (!partner.share_location) {
      return { ...base, state: 'partner-off' as const, title: name, line: tr(`${name} пока не делится местоположением`, `${name} isn’t sharing their location yet`) };
    }

    const mine = rows?.find((r) => r.user_id === me.id);
    const theirs = rows?.find((r) => r.user_id === partner.id);
    const dot = (row: { lat: number; lng: number; recorded_at: string }, who: string): Dot => ({
      lat: row.lat,
      lng: row.lng,
      initial: initial(who),
      stale: isStale(row.recorded_at),
    });
    const battery = freshBattery(theirs ?? null);
    const payload = {
      ...base,
      me: mine ? dot(mine, displayName(me.display_name, tr('Вы', 'You'))) : null,
      partner: theirs ? dot(theirs, name) : null,
      partnerBattery: battery,
      /* «Аня · 84 %» — the bolt while charging. */
      title: battery ? `${name} · ${battery.charging ? '⚡' : ''}${tr(`${battery.level} %`, `${battery.level}%`)}` : name,
    };

    if (!theirs) return { ...payload, state: 'waiting' as const, line: tr(`${name} пока не на карте`, `${name} isn’t on the map yet`) };
    const ago = agoLabel(theirs.recorded_at, lang);
    if (!mine) return { ...payload, state: 'ok' as const, line: tr(`Обновлено ${ago}`, `Updated ${ago}`) };

    const metres = distanceM(mine, theirs);
    const where = metres < TOGETHER_M ? tr('Вы рядом', 'You’re together') : tr(`${distanceLabel(metres, lang)} от вас`, `${distanceLabel(metres, lang)} away`);
    return { ...payload, state: 'ok' as const, line: `${where} · ${ago}` };
  });
}

export async function GET(request: Request) {
  const auth = await authorizeWidget(request);
  if ('response' in auth) return auth.response;
  const payload = await build(auth.admin, auth.userId);
  if (!payload) return Response.json({ error: 'no-profile' }, { status: 404 });
  return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const auth = await authorizeWidget(request);
  if ('response' in auth) return auth.response;
  const { admin, userId } = auth;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  /*
    {sharing: false} — «Не делиться» on the service's notification. A key may
    only ever switch sharing off, never on: switching on asks for consent in
    the app. The trigger from 0018 deletes the point in the same statement.
  */
  if (body?.sharing === false) {
    const { error } = await admin.from('profiles').update({ share_location: false }).eq('id', userId);
    if (error) return Response.json({ error: 'failed' }, { status: 500 });
    const payload = await build(admin, userId);
    if (!payload) return Response.json({ error: 'no-profile' }, { status: 404 });
    return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  }

  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: 'bad-request' }, { status: 400 });
  }
  const accuracy = Number(body?.accuracy);
  const at = typeof body?.at === 'number' ? new Date(body.at) : null;
  const battery = typeof body?.battery === 'number' ? Math.round(body.battery) : NaN;

  const { error } = await admin.rpc('bp_put_location', {
    who: userId,
    la: lat,
    ln: lng,
    acc: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
    at: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null,
    batt: Number.isInteger(battery) && battery >= 0 && battery <= 100 ? battery : null,
    chg: typeof body?.charging === 'boolean' ? body.charging : null,
  });
  if (error) return Response.json({ error: 'failed' }, { status: 500 });

  const payload = await build(admin, userId);
  if (!payload) return Response.json({ error: 'no-profile' }, { status: 404 });
  return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
