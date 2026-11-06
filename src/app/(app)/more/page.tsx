import { redirect } from 'next/navigation';

/*
  «Ещё» is gone: its five destinations now live as sub-tabs under «Обмен» and
  «Профиль», so nothing hides behind a list any more. The route stays as a
  redirect because it was a real destination — bookmarks and the installed PWA
  may still point at it.
*/
export default function MorePage() {
  redirect('/couple');
}
