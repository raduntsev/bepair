# Design

Recorded from the built system, not from intention. Source of truth for tokens is
`src/app/globals.css`; this file explains the rules that CSS cannot state.

## Direction

Bepair / Впаре deliberately speaks the **category standard** — the familiar
wellness-app language, executed at full craft. The user was offered a rolled,
non-obvious visual world plus three alternates and chose convention on purpose.
Do not re-litigate this by proposing a distinctive world for a new surface.

Quality bar: **Headspace** (warmth, approachability, confident colour) and
**Airbnb** (usability, calendar interaction, generous touch targets).

Failure conditions, all stated by the user: it must not read as a tracker or
dashboard, must not be saccharine or "valentine"-like, must not read corporate or
SaaS, and must not resemble the incumbent Lumina, which failed usability with
small, unintuitive controls.

## Colour

Restrained, which is the Operate floor: a neutral ground, one accent, and one
reserved saturated family.

- **Accent is indigo** (`--c-accent`), used only for primary actions, current
  selection, and state indicators — never decoration.
- **The mood spectrum is reserved.** Green→red (`--color-mood-1`…`-5`) means mood
  and nothing else. This is why the accent is indigo and the partner colour is
  amber: no control may wear green or red, or it reads as a mood value.
- **Never colour text with a mood colour on a neutral surface.** The spectrum
  fails contrast as text (1.98–4.21:1). Mood always appears as a filled shape
  beside an ink label. Text sitting *on* a mood colour uses `MOOD_INK`
  (`src/lib/mood.ts`), which clears 4.5:1 at every stop — the red end is the
  tightest at exactly 4.50, so the spectrum's dark end cannot be darkened further.
- **Both themes ship.** Light is the documented default; dark is designed, not
  inverted, because the primary scene is evening in bed with the lights off.

### Theme mechanics

Semantic values live as `--c-*` on `:root`, flipped by `[data-theme]` and by
`prefers-color-scheme`. `@theme inline` is **required** — without `inline`,
Tailwind 4 resolves the values at build time and the utilities stop tracking the
runtime variables, so the light theme silently never reaches components.

## Type

**Onest**, one family for everything, loaded via `next/font/google` with the
Cyrillic subset. The interface is Russian; a face without real Cyrillic is not a
candidate.

Set the family on `body` in the base layer, not through a `font-sans` utility: a
utility class on `<body>` outranks the base rule and reinstates the system stack.

Fixed rem steps, no fluid clamping: `text-2xl md:text-3xl` for page titles,
`text-lg` for section headings, `text-sm` for meta.

## Layout and components

- **Rounded cards on a cool near-white ground.** `rounded-2xl`, hairline
  `border-line`, `shadow-card`. Shadows always carry offset plus blur.
- **Navigation is a persistent rail** on `md+` and a **bottom tab bar** below it.
  The tab bar carries *every* destination including Settings — it holds the
  invite code and sign-out, which have no other route on a phone.
- **44px is the floor for anything tappable.** Use the `.tap` utility. The
  incumbent app's failure was small controls; this is the rule that answers it.
  Pages clear the tab bar with `pb-28` plus `safe-b` for the home indicator.

## The mood scale

The product's one required control (`src/components/MoodScale.tsx`).

- Colour only. **Never render a number** — a 1–10 readout was rejected because it
  makes days comparable.
- **No default value.** The handle is always visible so the control reads as
  draggable, but unset it carries no colour and omits `aria-valuenow`. It is a
  grip, not a value.
- The handle is inset half its width at each end so it never spills past the card;
  pointer mapping must use that same inset or taps land off the handle.
- The verbal label (`moodLabel`) is the non-colour channel — it is what a screen
  reader announces and what a colour-blind user reads. It is words, never numbers.
- Stays focusable when disabled so a closed past day can still be read aloud.

## Reciprocity

The thesis, and it is enforced in **SQL, not the UI**.

A partner's day and any sealed letter are gated by row-level security. Hiding
either in JSX means the content was already delivered to the browser — that is a
leak, not a design. Where the interface must show that something exists without
revealing it (a marked day in the calendar, a letter that has arrived), use a
`security definer` function that returns presence only.

Day entries are bound to a one-day window around `current_date`, not to an exact
match: the database compares in its own timezone while the client computes the
date locally, and an exact match rejects legitimate evening saves. The window is
still narrow enough that history cannot be backdated open.

## States

Every surface owes loading, empty, and error. Two rules learned the hard way:

- **A dropped error must never render as a confident empty state.** A failed
  partner fetch that renders "you are here alone", or a failed month fetch that
  renders a blank calendar, tells the user something false about their
  relationship.
- **Error copy is the product's own language**, naming the problem and the
  recovery. Never surface a raw PostgREST message — it is English Postgres text
  inside a Russian interface. Errors use `role="alert"`, confirmations
  `role="status"`.

Guarded writes (`.eq('is_completed', false).select()`) plus a row-count check are
how double taps are prevented; when a follow-up ledger write fails, roll the
first write back rather than leaving a task done with no points.

## Vocabulary

The services section avoids commerce language: it is **«Услуги»**, the action is
**«Попросить»**, and creating one is **«Предложить услугу»**. "Купить" reads as
buying the partner.

Task states are **ждёт выполнения → выполнено, партнёр ещё не видел → выполнено**.
The middle state means the partner has not noticed yet — never "on review", or
the product becomes an acceptance process.

## Known open items

Carried from the finish review, not yet closed: no illustration anywhere (empty
states are lucide glyphs in dashed boxes, the generic SaaS register the named
quality bar refuses); framer-motion is a dependency but the build has no authored
motion moment — notably the partner card unsealing, which is the thesis, happens
as an instant swap; the chosen mood colour touches a 72px dot and never reaches
the page; the day note textarea runs ~90ch on desktop, over the 65–75ch measure;
light-theme `ink-soft` and `ink-faint` differ by only 1.15:1, so the three-step
ink ramp renders as two; `letters/page.tsx` nests a filled container inside the
composer card; and `status` never flips to `delivered`, so `isDelivered` is a
client-side fiction until a scheduled job or trigger exists.
