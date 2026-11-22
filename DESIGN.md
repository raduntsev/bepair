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

- **Apple-style grouped cards on a grey ground** (`#F2F2F7` / pure black in
  dark). `rounded-2xl` (22px), `bg-surface`, `shadow-card`, **no border** — the
  ground separates them. Lists use `RowGroup` + `LinkRow`/`SwitchRow`: inset
  grouped, 30px tinted icon tile, hairline separators that start at the text.
- **Four type sizes, no more:** 28 (title), 17 (body and headings), 15
  (secondary), 13 (small). Every Apple-style and Tailwind size token resolves
  to one of them in `globals.css`, so a stray `text-lg` cannot add a fifth.
  Hierarchy comes from weight and colour. **Never all caps** — sentence case
  everywhere, including dates and section labels.
- **No instructional copy.** No subtitles that explain a screen, no «сначала
  сделайте…», no captions under controls. What to do next is shown, not told:
  the one block that needs you wears `.focus-ring` (accent ring + glow), an
  untouched control breathes (`.mood-breathe`), and a confirm button appears
  only once there is something to confirm. Status (a value, a time, a name)
  is fine; instructions are not.
- **Buttons:** filled (primary), grey tinted (secondary, accent text, no
  border), plain (ghost). Pressing dims to 70% instead of recolouring.
- **Navigation is the island** (`src/components/Island.tsx`) on every
  breakpoint: a black capsule at the bottom showing where you are, and beside
  it a round accent button that writes to the partner. With a mouse the
  capsule opens on hover; on touch, on tap, over a scrim. It grows into a
  compact list of the five sections — Сегодня · Переписка · Просьбы ·
  Календарь · Профиль — on Apple's sheet curve (0.56 s in, 0.46 s out);
  content waits for the shape on the way in and leaves first on the way out.
- **Five sections, each one question.** Переписка is letters and notes in
  one feed, with what waits for you on top. Просьбы holds Просьбы and Услуги
  as two tabs under one balance. Профиль is the pair, notifications and all
  settings as one list. Old routes (`/letters`, `/chronicle`) redirect.
- **Планёрка** lives under Календарь as a second tab («Календарь | Планёрки»):
  a weekly session in three steps — Колесо (seven spheres, 1–10, radar against
  last week), Вопросы (the couple's four questions, last answer one tap away),
  Дела (whose: mine / partner's / общее; status; решение). «Заполняет: Я |
  партнёр» lets one person type for the other; every row keeps both whose it is
  and who entered it. Fields save themselves and follow the other phone live.
  On the couple's chosen weekday a «Планёрка» card is «now» on Сегодня, right
  after your own day.
  When the couple meets is set once, so it is not on the page: the clock in
  the header opens it as a bottom sheet.
- **«Сегодня» shows the next thing, not everything.** Exactly one block is
  «now», in this order: your own day → a letter waiting → what the partner did
  for you → what you were asked. Blocks with nothing in them are not rendered.
- **44px is the floor for anything tappable.** Use the `.tap` utility. Pages
  clear the island with `.island-clearance` (applied once in `AppShell`).

## HeroUI

`@heroui/react` v3 is available as a component layer. It is built on Tailwind v4
and React Aria, so it sits on the stack already here; it brings no runtime of its
own and needs no provider. The product's hand-built components in
`src/components/ui/` stay — HeroUI is for what they do not cover (date pickers,
comboboxes, menus, the accessible overlay primitives), not a replacement.

Every HeroUI colour is bridged to a `--c-*` token in `globals.css`. The bridge is
unlayered on purpose, so it outranks HeroUI's own `@layer base` values, and each
value points at a `--c-*` token rather than being restated per theme. That is
what makes the `system` theme choice work: it removes `data-theme` entirely, so
HeroUI's `[data-theme="dark"]` selector never matches and its components would
otherwise sit light on a dark canvas.

Three decisions the bridge records, because the palette has no free hue:

- **`success` is the indigo accent, not green.** Green belongs to the mood
  spectrum. A green control would read as a mood value. The consequence is that
  `status="success"` and `status="accent"` now render identically — prefer
  `accent` and treat `success` as an alias.
- **`warning` is the partner amber**, the only warm hue in the system. Text on it
  is the mood ink (6.51:1 light, 8.96:1 dark); the accent ink would be white in
  the light theme and fail at 2.91:1. Amber already means *partner* here, so a
  filled `warning` must not sit beside a pair mark.
- **`danger` is the product's own red**, and its ink follows `--c-accent-ink`,
  which flips white → near-black with the theme and clears AA at both ends
  (5.43:1 light, 5.87:1 dark).

Two geometry rules cannot be expressed as variables and are written against
HeroUI's BEM classes, which is the mechanism its theming guide sanctions:

- HeroUI derives the whole Tailwind `--radius-*` scale from its own `--radius`
  and keys controls off `rounded-3xl`. `--radius-3xl` is pinned to `1rem` so
  controls match the product's buttons; `.card` and `.alert` are then set to
  `--radius-2xl` (1.75rem) because surfaces and controls both read from the 3xl
  step upstream and cannot differ through variables alone.
- HeroUI ships `md` buttons at 40px, shrinking to 36px from the `md:` breakpoint,
  and inputs at 38px. All are under the 44px floor, so `.button--md`,
  `.button--lg` and `.input` carry `min-block-size: 2.75rem`. `button--sm` is
  left alone: reaching for it is an explicit choice to go below the floor.

`--color-mood-ink` was added alongside the mood spectrum for text on any
saturated fill. It mirrors `MOOD_INK` in `src/lib/mood.ts` and does not flip,
because every saturated fill in the system stays light in both themes.

## The pair mark

The one graphic device: a single **ring made of two halves**, indigo on the left
for you and amber on the right for your partner, with the gaps at the top and
the bottom. It is the app icon, the wordmark and the empty-state illustration,
and it never wears green or red.

This replaces the earlier mark — a separate ring and disc standing side by side,
chosen when the direction was first set and rejected by the user on sight: two
circles that merely sit next to each other read as a diagram, not as a mark. The
replacement says what the ring and disc only labelled, because the product's
thesis is reciprocity and an open circle states it: **until the second person
marks their day, the circle is not closed.**

Both halves are the same circle (`r=48`, circumference 301.6) drawn with a dash
pattern, which is the whole reason the mark can move. A dash of `0.5` with a
round cap is a dot; a dash of `124` is a half of the ring. So the three states
are not three drawings — they are two elements at different dash lengths:

| State | Dash | Reads as |
| --- | --- | --- |
| `apart` | `0.5 301.1`, offsets `0` / `-150.8` | two dots at opposite ends of the orbit |
| `together` | `124 177.6`, offsets `61.75` / `-89.05` | the closed ring |
| `quiet` | your half closed, theirs a dotted arc | the partner has not arrived |

`quiet` draws the partner's half as its own `<path>`, because a repeating dash
pattern cannot be dotted on one half of a circle and solid on the other. That
one is a pose, not a frame of the animation.

Geometry and motion live in `globals.css` under `.pair-mark`; a dash transition
cannot be written as a utility class.

## Motion

Two authored moments, and nothing else moves.

**The card unseals.** When your own mark opens the partner's card in front of
you, the card opens from the lock outward and their mood disc springs in. An
already-open day plays nothing.

**The mark closes.** Going from `apart` to `together`, each dot grows outward
from its own centre over 820ms on `--ease-out-soft`, so both halves reach with
both ends at once and meet at the top and the bottom. Nothing is added or
removed; the browser interpolates the dash. Once closed, the ring turns once
every 16 seconds — the two of you holding on and going round. The turn starts
only after the ring has closed, and only while it is closed: an empty state does
not spin, or the movement stops meaning anything.

The turn is off wherever the mark is chrome rather than the subject (`spin={false}`
on the wordmark in the rail). A logo revolving all day is noise, and it costs
battery on the device this product is read on in bed.

**The pair waits.** Loading is the pair mark's two halves as two round
characters with glints for eyes (`src/components/PairLoader.tsx`): they glance
at each other and blink, shrink into the three dots of «typing…», roll a wave
through them, and spring back round. 3.6 s, CSS keyframes only. Used on the
opening screen and in every `Loading` block; buttons keep their small spinner.

**The tour lights the way.** «Обучение» (`src/components/Tour.tsx`) dims the
app and lights one real element at a time, with a card beside it. The light is
one rounded box whose shadow is the dimming, moved on a spring so it travels
with the page as it scrolls. Targets are marked with `data-tour`. It runs once
after onboarding and again from «Профиль → Обучение».

Onboarding questions slide; everything else is plain state change.
`prefers-reduced-motion` turns all of it off — the global reduced-motion block
already collapses both the dash transition and the turn, so the mark simply
holds the right pose.

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

## Language

Russian verbs agree with gender, so the profile carries an optional «он/она»
(`src/lib/words.ts`): «Аня отметила», «Алекс отметил», and the neutral
«отметил(а)» when unset. Names are declined for «от Ани» with a light rule set;
anything unrecognised stays as written. Prefer constructions that need no case
at all — a card titled «Аня» rather than «День Ани».

## Closed from the previous finish review

Empty states use the pair mark instead of glyphs in dashed boxes; the partner
card unseals with motion; the chosen mood tints the mood card; the note and
letters keep a 68ch measure (`.measure`); `ink-soft` is now `#4b4b63` so the
ink ramp reads as three steps; the letter composer separates its options with a
rule instead of a nested filled box; scheduled letters are flipped to delivered
by `bp_deliver_due()` (pg_cron, with the app as fallback).

`--c-partner-ink` was added: amber as text failed contrast (2.9:1 on white).
Amber stays for shapes and icons; text uses the ink.

## Known open items

Push copy is fact-only by design, which also hides harmless ping text from the
lock screen — revisit if couples ask for it. Calendar mood colours stay
indistinguishable for colour-blind users beyond the verbal label on the day
itself.
