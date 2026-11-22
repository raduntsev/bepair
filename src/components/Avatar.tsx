'use client';

import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useSignedUrl } from '@/components/Media';
import { BUCKET, squareImage, uploadMedia } from '@/lib/media';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { tr } from '@/lib/i18n';

/*
  A person's circle: their photo if they set one, otherwise the first letter of
  their name on their colour — indigo for you, amber for your partner, as in
  the pair mark.
*/
export function Avatar({
  path,
  name,
  who,
  className = 'size-12 text-headline',
}: {
  path: string | null | undefined;
  name: string;
  who: 'me' | 'partner';
  className?: string;
}) {
  const url = useSignedUrl(path);
  const tone = who === 'me' ? 'bg-accent text-accent-ink' : 'bg-partner text-mood-ink';
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${tone} ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, expiring storage URL
        <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span aria-hidden>{name.trim().charAt(0).toUpperCase() || '·'}</span>
      )}
    </span>
  );
}

/* Your own circle, tappable: choose a photo, it is squared, uploaded and set. */
export function AvatarPicker({ className = 'size-20 text-title-1' }: { className?: string }) {
  const { profile, spaceId, updateProfile } = useSpaceAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const choose = async (file: File | undefined) => {
    if (!file || !spaceId) return;
    setBusy(true);
    setFailed(false);
    try {
      const square = await squareImage(file);
      const previous = profile?.avatar_url;
      const path = await uploadMedia(spaceId, 'avatars', square);
      if (!(await updateProfile({ avatar_url: path }))) throw new Error('save');
      /* The old photo is nobody's any more. */
      if (previous?.includes('/avatars/')) supabase.storage.from(BUCKET).remove([previous]).then(() => undefined);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={tr('Поменять фото', 'Change photo')}
        className="group relative rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft"
      >
        <Avatar path={profile?.avatar_url} name={profile?.display_name ?? ''} who="me" className={className} />
        <span
          aria-hidden
          className={`absolute -right-0.5 -bottom-0.5 flex size-8 items-center justify-center rounded-full bg-surface text-accent shadow-card ring-2 ring-surface transition-transform group-active:scale-95 ${busy ? 'animate-pulse' : ''}`}
        >
          <Camera className="size-4" />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {failed && (
        <p role="alert" className="text-footnote text-danger">
          {tr('Фото не загрузилось', 'The photo didn’t upload')}
        </p>
      )}
    </div>
  );
}
