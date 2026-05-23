# Padea Catering Ops — Design System

A design system for **Padea Education**'s internal catering operations console.
This is not a marketing site and not a generic admin panel; it is a focused
operations product for catering coordinators and reviewers.

## Context

**Padea** is a tutoring company. Its catering operations team runs a weekly
service cycle: source-data ingestion → menu setup → validation → order
generation → review → approval → caterer exports → audit. The current
operator surface is a set of Streamlit MVPs (`app/menu_setup_mvp.py`,
`app/order_review_mvp.py`); the next surface is a Next.js + Supabase web app
(see decision **D-14**), and this design system is the visual + interaction
foundation for that app.

The audience for this UI is small (operations coordinator, reviewer/manager)
and the workflow is high-stakes (real students with dietary restrictions, real
caterer orders). The design optimises for **clarity, scannability, and audit
visibility**, not delight.

### Sources provided

| Source | Where | Notes |
| --- | --- | --- |
| Brand logo | `uploads/padeaeducation_logo.jpg` | 200×200 JPG, crimson square with white graduation cap. Sampled brand red = `#A51C30`. |
| Product spec | The "Operator Website Plan" pasted into the brief | Drives IA, page plan, components, visual direction. |

> Heads-up: there is **no existing codebase, Figma, or component library**
> attached. The visual direction below is synthesised from the spec's stated
> principles ("operations product", "dense but calm", "restrained neutral
> base"), plus standard shadcn/ui + Lucide conventions called out in the spec.
> If a codebase or Figma file exists, please attach it and we'll align.

---

## Index

```
.
├── README.md                  — you are here
├── SKILL.md                   — Claude Skill manifest (portable)
├── colors_and_type.css        — design tokens (CSS vars) + base type roles
├── assets/                    — logo + any future brand assets
├── preview/                   — design-system tab cards (small specimens)
└── ui_kits/
    └── operator/              — Next.js operator console UI kit
        ├── README.md
        ├── index.html         — click-thru of the five core screens
        ├── *.jsx              — components (AppShell, DataTable, etc.)
        └── screens/*.jsx      — Dashboard, Menu, Order Run, Exports, Audit
```

---

## Brand at a glance

- **Crimson** (`#A51C30`) — used sparingly, for the wordmark, primary actions,
  active-nav indicators, and focus rings. Not for surfaces or alerts.
- **Warm slate neutrals** — the base of every screen. ~95% of the pixels.
- **Semantic palette** — green/yellow/red/blue/grey for the five status
  states the spec calls out: `Approved`, `Unreviewed`, `Blocked`, `Generated`,
  `Superseded`.
- **Geist Sans + Geist Mono** — the type system. Geist Mono is used for any
  identifier or timestamp; that's a feature, not a style flourish.
- **Instrument Serif italic** — a sliver of warmth, used only for the Padea
  wordmark.

> **Font substitution flag.** No font files were provided. The system uses
> **Geist** (Vercel, OFL — free) loaded from Google Fonts. If Padea has a
> licensed corporate face (e.g. Söhne, Graphik, GT America), please share the
> files and I'll swap. Geist is a deliberate choice for a Next.js operator UI;
> it has matching tabular figures in mono which suit dense status tables.

---

## CONTENT FUNDAMENTALS

The spec is unusually explicit about voice — and unusually unusual for an
internal tool. Most internal tools talk like marketing software; Padea's spec
asks for the opposite. The system follows it literally.

### Tone

- **Concrete, never reassuring.** "Approval disabled — 3 blocking allocation
  issues" beats "Looks like we need to review a few things". The UI never
  euphemises.
- **Stateful nouns, not friendly verbs.** Buttons say "Approve run", "Record
  export", "Reopen run" — not "Looks good!" / "Send it" / "Try again".
- **No silent fixes** is a content rule as much as a behaviour rule. If data
  is ambiguous we **say what is unresolved**; we do not paper over it.
- **No exclamation marks. No emoji.** Not in UI strings, not in error toasts,
  not in empty states. This is an audit-bearing surface.

### Casing

- **Sentence case** for everything except the wordmark and explicit status
  tokens. Headings: "Needs attention". Buttons: "Approve run".
- **Uppercase only** for short eyebrow/label text above sections and for the
  status tokens themselves (`APPROVED`, `BLOCKED`, `EXPORTED`) — these read
  as labels, not sentences.

### Pronouns

- **No "you", no "we"** in operator-facing copy. The UI describes system
  state, not the operator's experience. _"3 variants are unreviewed"_, not
  _"You still need to review 3 variants"_.
- The exception is destructive confirmations and reason dialogs, which can
  use "Confirm you want to reopen this approved run." — second-person reads
  as a soft challenge there.

### Status vocabulary

The system has a fixed list of state words. Use these literally; do not
invent synonyms.

| Token | Use for |
| --- | --- |
| `Ready` | Source data ingested, prereqs met. |
| `Unreviewed` | A dish variant or item is missing required review. |
| `Generated` | An order run has been produced but not approved. |
| `Approved` | An order run has been approved with a note. |
| `Exported` | A caterer communication has been recorded as exported. |
| `Blocked` | Has at least one validation error or allocation issue. |
| `Superseded` | An earlier run replaced by a newer one. |
| `Issue` / `Finding` | A single validation or allocation problem. |

We say **"exported"**, never "sent". Live email is out of scope; the UI must
not imply we sent anything.

### Examples

| Don't | Do |
| --- | --- |
| "Looking good — ready to approve!" | "Run 24-W18-03 generated, 0 issues. Approval available." |
| "Send to caterer" | "Record export — Padea Kitchen Co." |
| "Oops, something went wrong" | "Save failed: 2 of 4 offers rejected. Open issues." |
| "All set ✅" | "All 14 variants reviewed for week of 6 Oct." |
| "👀 Heads up" | "3 variants unreviewed. Cannot generate run." |

---

## VISUAL FOUNDATIONS

The visual language is deliberately dialled back. Crimson is a **wayfinding
accent**, not a surface colour. The interface should feel like Linear or
Stripe Dashboard with one Padea-red point of light.

### Colour

- **Surface stack.** Page = warm `#F4F4F2`. Cards = pure white. Sunken wells
  (insets, code blocks) = `#FAFAF9`. There are only three surface layers and
  they don't nest deeper than two.
- **Foreground stack.** 5 text greys (`--fg-1` strongest through `--fg-5`
  disabled). All text is on the warm slate ramp; no pure black.
- **Brand crimson** appears in four places only: the Padea mark, the active
  primary button, the active nav indicator (a 2px left bar + crimson
  foreground), and focus rings. That's the whole list.
- **Semantic colour** is the language for status badges, row tints, and
  inline alert bars. Tints are very light (~96% L) so a table row tinted red
  reads as "this row has a finding" not "DANGER".
- **No gradients** anywhere. No bluish-purple, no warm orange, no aurora.
- **No marketing-style colour cards** with rounded left accents.

### Typography

- **Geist Sans 400/500/600** is the entire UI face. 700 is reserved for the
  occasional big metric.
- **Geist Mono 400/500** is used for: run IDs (`24-W18-03`), week keys
  (`2026-10-06`), timestamps, dollar amounts in counts, hashes, and any
  primary-key-shaped string. Tabular figures are on by default.
- **Instrument Serif italic** is the wordmark. Pair with the cap mark; never
  use it for body or headings.
- Default body is `15px / 1.45`. Dense table body drops to `14px / 1.4`.
  Nothing in the operator UI goes below 12px.
- Headings are tight: 26/20/16/14 with `letter-spacing: -0.012em` on the two
  largest sizes.

### Spacing & rhythm

- 4px base scale, with `s-1` (4) through `s-16` (64) tokens.
- Tables use 8px row padding vertical, 12px horizontal. Compact mode drops to
  6/10. Tables are designed for repeat reading; that's a deliberate density
  choice, not an accident.
- Cards use 20px padding. Card-to-card gutter is 16px.
- Page gutter is 24px. Sidebar is 240px (or 56 collapsed).

### Backgrounds & imagery

- The system has **no decorative imagery**. No hand-drawn illustrations, no
  textures, no full-bleed photography. The brand logo is the only image asset.
- Empty states are typographic. A small Lucide icon at 24–32px in `--fg-5`
  may sit above the empty-state text. That's the ceiling.
- The login screen is the one place a hint of brand atmosphere is allowed —
  a flat crimson panel on the left, white form on the right. No gradient.

### Borders & dividers

- **1px borders** in `--border-1` are the default for cards, inputs, table
  edges.
- **Row dividers** in tables use `--border-2` (lighter) for less visual rule.
- Cards do **not** have a coloured left accent ever. The only coloured
  border in the system is the **active-nav 2px crimson left bar** on a list
  item, and the **2px focus ring** on focusable elements (crimson, on a 3px
  18%-alpha halo).
- Inputs use a 1px inset border, not a shadow.

### Shadows & elevation

- Five shadow tokens, all very subtle:
  - `--shadow-xs` — table header underline
  - `--shadow-sm` — default card shadow (barely there)
  - `--shadow-md` — drawers/sheets edge
  - `--shadow-lg` — popovers
  - `--shadow-pop` — modal/dialog
- There is **no glow, no inner glow, no neon**. Elevation reads through
  shadow + 1px border together.

### Corner radii

- Buttons, badges, inputs: **7px** (`--r-md`). This is the system's signature
  radius — softer than enterprise (4px), harder than playful (12px).
- Cards, drawers, dialogs: **10px** (`--r-lg`).
- Pills (status chips with text only): **999px** (`--r-pill`) — but only used
  for the few "filter chip" patterns. Status badges in tables use `--r-md`,
  not pills.

### Cards

- Card = white surface, 1px `--border-1`, `--r-lg`, `--shadow-sm`, 20px pad.
- Cards never nest. A card holds a table, a checklist, a key/value list, or
  a single tool — never another card.
- Section headers inside cards: 14px semibold, 12px caption underline of
  divider, then content.

### Motion

- **Functional only.** Hover transitions on rows and buttons (`120ms`
  `ease-out`). Drawer/dialog enter is `180ms`. There is no spring physics,
  no parallax, no scroll-linked motion.
- Reduced-motion respects `prefers-reduced-motion`; in that case the
  transitions drop to 0ms but the styles still apply at end-state.

### Hover & press states

- **Buttons (primary):** crimson → `--padea-crimson-hover` on hover (slightly
  brighter), → `--padea-crimson-press` on active (slightly darker). No
  shrink.
- **Buttons (secondary):** background goes from white → `--n-50` on hover,
  → `--n-100` on active. Border stays.
- **Buttons (ghost):** background goes from transparent → `--n-100` on
  hover.
- **Table rows:** background `transparent` → `--surface-row-hover` on hover.
  No scaling. Cursor stays default unless the row is a link, then pointer.
- **Nav items:** as table rows, plus active state adds the 2px crimson left
  bar and crimson text.
- **Focus:** every focusable element gets `--shadow-focus` (crimson, 18%
  alpha, 3px). No browser-default outline.
- **Disabled:** 50% opacity, no pointer events, no cursor change.

### Transparency, blur, gradients

- The system uses **no backdrop blur** except in the modal scrim
  (`rgba(17,17,16,0.4)` solid, no blur — keep it simple) and an optional
  `8px` blur on the top-bar background when scrolled, if you want it.
- **No transparency in surfaces.** Cards are solid white. Tints (badge
  backgrounds) are solid, not alpha.
- **No gradients.** Period.

### Layout rules

- Persistent left rail (240px) + 52px top bar. Both fixed on scroll. Content
  area scrolls.
- Page max width: `1440px`, with a 24px gutter.
- Tables are full-bleed within their card; the card itself respects the page
  gutter.
- Page header row: title left, contextual page actions right. Never centre,
  never split into three columns.

---

## ICONOGRAPHY

- **Primary icon set: [Lucide](https://lucide.dev)**, loaded from CDN as
  `lucide@latest`. The spec explicitly calls for it. Lucide's 1.5px stroke,
  24px viewport, and rounded line caps match the visual register exactly.
- **Default size: 16px** in buttons, 18px in nav items, 14px inline with
  body text.
- **Stroke colour** = current text colour. We do not colour icons except in
  semantic status badges, where the icon takes the badge's `--fg`.
- **No icon fills.** Lucide is stroke-only; we keep it that way.
- **No emoji** in any operator-facing surface. Not in copy, not in toasts,
  not as nav glyphs. The audit log surfaces actor strings verbatim and even
  there emoji are filtered out at render.
- **No unicode dingbats** (✓ ✗ → ⚠ etc.) — use the corresponding Lucide icon
  (`Check`, `X`, `ArrowRight`, `AlertTriangle`).
- **The brand mark.** The Padea graduation cap from `assets/padea-logo.jpg`
  is the only bespoke icon. It is used at 28px in the sidebar header,
  alongside the "Padea" Instrument Serif wordmark. Do not redraw it.

### Icon reference

Common icons mapped to operator-UI concepts (Lucide names):

| Concept | Icon |
| --- | --- |
| Dashboard | `LayoutDashboard` |
| Weeks | `CalendarDays` |
| Menu setup | `UtensilsCrossed` |
| Validation | `ShieldCheck` |
| Orders | `ListChecks` |
| Order run | `FileCog` |
| Exports | `Send` (used at rest, not as "send live") |
| Caterers | `Building2` |
| Students | `Users` |
| Audit | `History` |
| Settings | `Settings` |
| Approve | `CircleCheck` |
| Reopen | `Undo2` |
| Override | `Pencil` |
| Blocked | `OctagonAlert` |
| Unreviewed | `CircleAlert` |
| Generated | `Sparkle` (sparingly) |
| Superseded | `Archive` |

---

## Open notes & deferrals

- **No real product data** has been wired up. Numbers, run IDs, caterer
  names, and dates in the UI kit are illustrative fixtures.
- **Auth provider not decided** (spec open question). The login screen
  mocks email + password; magic-link variant is a five-minute swap.
- **Dark mode** is not in the system yet. Operators work in daylight in a
  shared office; dark mode is deferred until requested.
- **Mobile** is also out of scope. The console is designed for ≥1280 viewports.
