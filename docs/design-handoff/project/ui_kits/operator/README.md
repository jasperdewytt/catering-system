# Padea Operator Console — UI Kit

A high-fidelity, click-thru recreation of the Next.js operator console
described in the "Operator Website Plan". This kit is the visual + interaction
foundation for the production app, not the production app itself.

## What's in here

```
operator/
├── index.html          Entry — wires React + Babel and loads everything
├── ui-kit.css          Component classes (built on colors_and_type.css)
├── Icons.jsx           Inline Lucide-style stroke icons (no CDN dep)
├── Primitives.jsx      Button, Badge, Card, Tag, Alert, Metric, Tabs, Empty
├── AppShell.jsx        Sidebar rail + topbar + content slot
├── app.jsx             Screen router + auth gate
└── screens/
    ├── Login.jsx
    ├── Dashboard.jsx
    ├── MenuSetup.jsx
    ├── OrderRun.jsx
    ├── Exports.jsx
    └── Audit.jsx
```

## Screens covered

The spec's **"Initial Design Targets"** list calls out five screens for the
first design pass. All five are in here:

1. **Dashboard** — active week, needs-attention queue, readiness checklist,
   upcoming sessions table, recent audit feed.
2. **Menu setup** — caterer tabs, variant table with dietary/ingredient flags,
   weekly offers panel with minimum-order callout.
3. **Order run detail** — header strip, tabs for lines / allocations /
   issues / contacts / approval history, reopen dialog with reason capture.
4. **Caterer Emails** — caterer list, communication snapshot, recipients table,
   rendered draft, email preparation events timeline.
5. **Audit** — filterable append-only table, drawer with before/after JSON.

A **Login** screen and minimal placeholders for the remaining routes
(Weeks, Validation, Caterers, Students, Settings) are also wired so the
nav doesn't dead-end.

## How to read it

Open `index.html`. The app boots into the Dashboard. Use the left rail to move
between screens; some screens have CTAs that navigate into others (Dashboard
"Prepare caterer emails", Order run "Open caterer emails", Reopen run dialog, etc.).

## Component conventions

- All buttons go through `<Button variant="primary|secondary|ghost|danger">`.
- All status text goes through `<StatusBadge token="Approved|Generated|Blocked|…" />` — never plain text.
- All identifiers (run IDs, week keys, timestamps) use the `.mono` class
  (Geist Mono with tabular figures).
- All tables share `.tbl` styling. Use `<tr className="group-row">` for the
  per-caterer-or-session group separator rows.

## Known cuts

- This is a mock. No data fetching, no Supabase, no Server Actions. Buttons
  navigate but do not write.
- No keyboard shortcuts wired beyond browser defaults.
- No dark mode (deferred per system).
- Lucide icons are inlined as small SVG components rather than pulled from
  CDN, to keep the kit fully offline-friendly. The set covers the operator UI
  but is not the full Lucide library — add to `Icons.jsx` as you need.
