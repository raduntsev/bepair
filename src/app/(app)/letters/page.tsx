import { redirect } from 'next/navigation';

/* Merged into «Переписка» — one feed for letters and notes. Kept as a redirect for old links and push taps. */
export default function Page() {
  redirect('/messages');
}
