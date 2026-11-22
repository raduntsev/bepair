/*
  Two languages, Russian and English, without a framework. Every visible
  string is written as a pair at the place it is used — tr('Сегодня', 'Today')
  — so the two always travel together and nothing is lost behind a key.

  The language is decided before the first paint by the inline script in the
  root layout (ThemeScript): the saved choice if there is one, otherwise the
  phone's language — Russian for ru/uk/be/kk, English for anything else. It is
  written to <html lang>, and this module reads it from there, so every tr()
  call already knows the answer during the first render. On the server, which
  renders before any of that, it is Russian.

  Switching language reloads the app: it happens once in a lifetime, and a
  reload guarantees no screen is left half in the old language.
*/
export type Lang = 'ru' | 'en';
export const LANG_KEY = 'bepair-lang';

function initial(): Lang {
  if (typeof document === 'undefined') return 'ru';
  return document.documentElement.lang === 'en' ? 'en' : 'ru';
}

let current: Lang = initial();

export function getLang(): Lang {
  return current;
}

export function isEnglish() {
  return current === 'en';
}

/* The string in the current language. */
export function tr(ru: string, en: string) {
  return current === 'en' ? en : ru;
}

/* For code that already knows whose language it writes in (server, push). */
export function trIn(lang: Lang | null | undefined, ru: string, en: string) {
  return lang === 'en' ? en : ru;
}

/* English plural: 1 day, 2 days. Russian has its own in dates.ts. */
export function enPlural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/* The saved choice, or null when the phone's language decides. */
export function savedLang(): Lang | null {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return value === 'ru' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

export function chooseLang(choice: Lang | null) {
  try {
    if (choice) localStorage.setItem(LANG_KEY, choice);
    else localStorage.removeItem(LANG_KEY);
  } catch {}
  window.location.reload();
}

/* Read by the inline script before first paint; kept here so both stay in step. */
export const LANG_SCRIPT = `try{var l=localStorage.getItem('${LANG_KEY}');if(l!=='ru'&&l!=='en'){var n=(navigator.languages&&navigator.languages[0])||navigator.language||'ru';l=/^(ru|uk|be|kk)/i.test(n)?'ru':'en'}document.documentElement.lang=l}catch(e){}`;

/* What the phone alone would choose, for showing «Авто (English)». */
export function deviceLang(): Lang {
  if (typeof navigator === 'undefined') return 'ru';
  const n = navigator.languages?.[0] ?? navigator.language ?? 'ru';
  return /^(ru|uk|be|kk)/i.test(n) ? 'ru' : 'en';
}

/*
  Runs `fn` as if the app were in `lang`. For the server, which writes widget
  text in the reader's language: the block must be synchronous (no await
  inside), so no other request can run while the language is swapped.
*/
export function inLang<T>(lang: Lang, fn: () => T): T {
  const previous = current;
  current = lang;
  try {
    return fn();
  } finally {
    current = previous;
  }
}
