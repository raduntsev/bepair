import { plural } from './dates';
import { trIn, type Lang } from './i18n';
import { isNative, WidgetBridge } from './native';

/*
  «Где мы»: shared by the map screen and the «Карта» widget's endpoint, so the
  app and the home screen say the same distance in the same words.
*/

export interface Point {
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
  /* The phone's charge when the point was sent, 0–100; null when the phone does not say. */
  battery?: number | null;
  charging?: boolean | null;
}

export interface LocationState {
  sharing: boolean;
  partner_sharing: boolean;
  has_partner: boolean;
  me: Point | null;
  partner: Point | null;
}

/* How often a point is sent: the native service and the open app both keep to it. */
export const SEND_EVERY_MS = 5 * 60 * 1000;

/* Closer than this, two points are one place: «вы рядом». */
export const TOGETHER_M = 150;

/* Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* «350 м», «3,2 км», «120 км». */
export function distanceLabel(m: number, lang: Lang) {
  const locale = lang === 'en' ? 'en-GB' : 'ru-RU';
  if (m < 1000) {
    const rounded = Math.max(10, Math.round(m / 10) * 10);
    return trIn(lang, `${rounded} м`, `${rounded} m`);
  }
  const km = m / 1000;
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km);
  return trIn(lang, `${text} км`, `${text} km`);
}

/* «только что», «5 мин назад», «3 ч назад», «2 дня назад». */
export function agoLabel(iso: string, lang: Lang, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 2) return trIn(lang, 'только что', 'just now');
  if (minutes < 60) return trIn(lang, `${minutes} мин назад`, `${minutes} min ago`);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return trIn(lang, `${hours} ч назад`, `${hours} h ago`);
  const days = Math.round(hours / 24);
  return trIn(lang, `${days} ${plural(days, 'день', 'дня', 'дней')} назад`, `${days} ${days === 1 ? 'day' : 'days'} ago`);
}

/* A point older than this is shown as a memory, not as «where they are». */
export const STALE_MS = 60 * 60 * 1000;

export const isStale = (iso: string, now = Date.now()) => now - new Date(iso).getTime() > STALE_MS;

/*
  OpenStreetMap's own tiles: free and keyless (CARTO's basemaps now want a key).
  The app quiets them to grey (and inverts them in the dark theme) so the map
  stays a backdrop under the two dots. The attribution is required, and is
  shown on the map and on the widget.
*/
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_MAX_ZOOM = 19;
export const TILE_ATTRIBUTION_HTML =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
/* The same words without the link, for a map that is itself inside a link (the profile's card). */
export const TILE_ATTRIBUTION_TEXT = '© OpenStreetMap';

/*
  The partner's charge, beside their avatar and on the «Карта» widget. It rides
  with the point, so it obeys the same rule; an old point says nothing about
  the phone now, so a stale one shows no charge at all.
*/
export interface Battery {
  level: number;
  charging: boolean;
}

export function freshBattery(point: Pick<Point, 'recorded_at' | 'battery' | 'charging'> | null | undefined, now = Date.now()): Battery | null {
  if (!point || point.battery == null || isStale(point.recorded_at, now)) return null;
  return { level: Math.round(point.battery), charging: !!point.charging };
}

/* «84 %», «84 %, заряжается». */
export function batteryLabel(b: Battery, lang: Lang) {
  return b.charging ? trIn(lang, `${b.level} %, заряжается`, `${b.level}%, charging`) : trIn(lang, `${b.level} %`, `${b.level}%`);
}

/* The phone's charge: from the native shell, else what the browser tells (null in Safari, Firefox, an older APK). */
export async function readBattery(): Promise<Battery | null> {
  if (isNative()) {
    const b = await WidgetBridge.battery().catch(() => null);
    if (b && typeof b.level === 'number' && Number.isFinite(b.level)) return { level: Math.round(b.level), charging: !!b.charging };
  }
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    if (typeof nav.getBattery !== 'function') return null;
    const b = await nav.getBattery();
    if (!Number.isFinite(b.level)) return null;
    return { level: Math.round(b.level * 100), charging: !!b.charging };
  } catch {
    return null;
  }
}
