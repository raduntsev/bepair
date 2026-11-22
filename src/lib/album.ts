/*
  The album turns over every three hours, by the clock: both phones compute the
  same photo without talking to each other, and the app can show which one the
  widget has now.
*/
export const ALBUM_ROTATION_MS = 3 * 60 * 60 * 1000;

export function albumIndex(count: number, now = Date.now()) {
  if (count <= 0) return 0;
  return Math.floor(now / ALBUM_ROTATION_MS) % count;
}
