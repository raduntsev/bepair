# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users: two people in a romantic relationship who share one authenticated "space" (Supabase-backed, invite-code or magic-link paired). They use the product daily, usually separately, to record their own day and read/respond to their partner's.

## Product Purpose

Bepair (RU: Впаре) is a shared daily space for a couple — not a mood tracker, not a social network. Its job is to keep two people honestly in sync about how each is doing, to carry small requests between them without friction, and to give letters/notes a place that feels earned rather than performative. Success is a couple that keeps returning to it daily without the product turning their relationship into content, metrics, or a performance review.

## Positioning

Distinguishing mechanism: reciprocity is structural, not just a norm. A partner's day, and any letter addressed to them, stays hidden until the viewer has marked their own day first ("сначала свой день") — the product enforces mutual vulnerability instead of asking for it. Mood is read as color on a scale, never as a number, specifically to avoid the comparison/scoring dynamic that numeric self-tracking apps produce. This is a couple's product, not an individual's — nearly every setting that touches what a partner can see is a paired setting, not a personal one.

## Operating Context

- Renamed from Lumina to Bepair (EN) / Впаре (RU); the old name and old visual identity should not appear anywhere in the redesign.
- Existing backend: Supabase (auth via magic link today, invite-code pairing into a shared "space"). Google OAuth onboarding is a planned addition, Secret Link remains a fallback path, not removed.
- Existing runnable app: Next.js 16 (App Router) + React 19 + Tailwind CSS 4, currently a single page (`src/app/page.tsx`) that gates on auth → space membership → renders one component, `DailyPulse`, inside modals for Letters/Store/Settings/Analytics/Guide. There is no Tasks UI, no Calendar UI, no side "you & partner" panel, and no side-rail navigation yet — these are new builds, not restyles.
- Target platform for this pass: adaptive responsive web (single Next.js codebase, desktop and mobile breakpoints). Native iOS/Android apps (needed for true home-screen widgets) are an explicit later phase, not built now.
- Design references supplied by the user (usability/behavior/mood inspiration, not literal visual copies): Airbnb (usability, calendar, bottom nav on mobile), Headspace (overall warmth, approachability, color use), How We Feel (motion smoothness, narrative screen transitions), Stoic (journaling/balance feeling).

## Capabilities and Constraints

Confirmed functional scope for this pass (Phase 1 — core daily flow), in the user's stated priority order:

1. **Mood** — the only required field per day. Color-only scale (green → red gradient), a "magnifier" indicator dot that takes the color of its position on the scale. No default value, no numeric 1–10 display anywhere (rejected deliberately as vulgar/comparison-inducing).
2. **Note** — free-text block accompanying the mood entry (how the day went / thoughts). Exists so a mood rating is never given without context.
3. **Letters** — rich-text editor with audio/photo/video attachment (functionally adequate today, not being rebuilt functionally) gains three new mechanics: Draft (visible only to author until sent), Scheduled send (deliverable at a chosen time, cancellable until delivered — irreversibility begins at delivery, not at pressing send), and Reveal-after-day-marked (partner sees a letter arrived but not its content until they mark their own day).
4. **Tasks** — new feature. One partner asks the other for something (help, attention, etc.) without it feeling like a demand. Completing a task earns points (weight = importance the requester set); points spend in the Store. Tasks remain editable after being sent (an intentional exception to the "day is locked once submitted" rule, since a task describes a future action, not a past day). Template packs exist so partners don't retype the same requests. Three states: awaiting completion → completed; awaiting confirmation → completed (the middle state reads as "partner hasn't seen it yet," explicitly not "under review" — this must not read as work being submitted for approval).
5. **Store (services shop)** — spend points earned from tasks on a service the partner offers. Partners create their own store listings. Functionally works; wording is unresolved — "Buy" reads like purchasing the partner, and the whole shop/commerce vocabulary is an open question the redesign should soften (candidates to explore, not commit to: "запросить"/"request", "заказать"/"redeem" — final copy is a design decision, not fixed here).
6. **Calendar** — navigate the couple's days. Reimagined away from a heatmap (tracker-style intensity fill) toward a day selector with an explicit, readable state: has content / no content, a "both marked" state with no visual splitting of the cell, and higher contrast for the partner's day specifically.
7. **Right panel "you & partner"** — organized by whose day it is; the partner's block stays visually locked until the viewer marks their own day — this should read as protection, not as a broken/empty state.
8. **Navigation** — a persistent side "remote control" rail (not a top icon row) covering: day, calendar, letters, tasks, store, settings. Must adapt sensibly to mobile (a bottom bar, per the Airbnb reference, is an acceptable mobile pattern — final call is a design decision in new-work, not fixed here).

Built in phase 2 (October 2026): Google OAuth + onboarding (name, «он/она», eight relationship questions), notification system (in-app feed + web push), couple profile, personal vs. paired settings (paired change only by agreement of both), data export (JSON of your own data), cycle tracking (private, neutral ink), days-together counter + «комбо», «near» vs. «long-distance» mode (partner's local time), «Летопись» and «Весточка».

Still deferred (do not block architecturally): phone home-screen widgets (need native apps), important-dates calendar layer, neural-network analysis of exported data.

Stack is not a hard constraint: the current stack (Next.js 16, Tailwind 4, Supabase, framer-motion, recharts, lucide-react) is the starting point, and new dependencies may be added if a feature genuinely needs one (e.g. a calendar/date library, a rich text editor primitive) — do not restrict candidate implementation approaches to "what's already installed."

## Brand Commitments

Name: Bepair (EN) / Впаре (RU). No existing logo, typeface, or color palette is binding.

**Standing visual preference (user decision, 2026-08-04):** the user was offered a rolled non-obvious visual world plus three alternates and deliberately chose the category standard instead. The commitment is therefore the familiar, conventional wellness-app language — rounded cards, friendly grotesk, a light ground with a warm pastel-leaning palette, a bottom tab bar on mobile — executed at full craft, without irony and without smuggling in exotic devices. Do not re-litigate this by proposing a distinctive visual world on later surfaces; the convention is the commitment.

**Quality bar (the craft level to reach, not products to copy):** Headspace (warmth, approachability, confident use of color, care in illustration and motion) and Airbnb (usability, calendar interaction, bottom navigation, generous touch targets, unambiguous states).

Two things this convention must still satisfy, both stated by the user as failure conditions: it must not become saccharine ("valentine" register — hearts, pink, cupids), and it must not repeat the current Lumina implementation, which fails usability with small, unintuitive controls. Note also that the current Lumina palette (cream `#F5F0E8` ground plus terracotta `#B85C3A` accent, sharp corners, no shadows, "Swiss grid") is an explicit anti-reference: a light warm ground is allowed, but landing on cream-plus-terracotta again would reproduce the thing being replaced.

The mood gradient (green→red) is a product-level color concept that persists regardless of visual direction.

## Evidence on Hand

- Live codebase at `src/` reflecting the current (pre-redesign) Lumina implementation — treated as functional/behavioral evidence for what already works (Letters editor, Supabase auth/space model), and as visual anti-reference only (old look is being fully replaced, not refined).
- A Figma file was shared (`https://www.figma.com/design/4AO9q4T0kVSnQnDrNttPdC/Doe`) but was not accessible this session — the Figma MCP connector requires interactive OAuth authorization the user hasn't completed yet. Treat any Figma-sourced facts as absent until the user authorizes access and re-shares.
- No existing screenshots of the current app were actually attached in this session despite being referenced; current-state evidence comes from reading `src/` directly instead.

## Product Principles

1. **Reciprocity is enforced by the system, not requested from the couple.** "See your own day first" gates the partner's day, letter content, and future notifications alike — never bypassed by a side channel.
2. **No comparison, no scoring, no vanity metrics.** Mood is color not a number; the partner profile favors qualitative shared facts (days together, letters sent) over follower/following-style metrics.
3. **Irreversibility is deliberate and specific, not a blanket rule.** A day/mood entry is locked once submitted; a task stays editable because it describes the future, not the past; a scheduled letter stays cancellable until the moment of delivery, not the moment of writing.
4. **Nearly everything that touches partner-visible access is a paired setting.** Symmetric by default — applies to both or neither.
5. **The product's job is coordination and reciprocity, not engagement/content.** Any addition (store copy, notifications, profile) is evaluated against whether it turns the relationship into performance or content, and rejected/reworded if it does.

## Accessibility & Inclusion

No accessibility standard specified by the user; the mood scale being color-only (green→red) is a confirmed product decision that will need a non-color-dependent affordance (e.g. label text, position, texture) for color-vision-deficient users — flag this for new-work rather than deciding the mechanism here.
