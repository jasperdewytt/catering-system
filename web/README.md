# Padea Operator Website

Next.js 16 App Router operator console for the catering workflow.

## Setup

```bash
pnpm --dir web install
cp web/.env.example web/.env.local
pnpm --dir web dev
```

`web/.env.example` intentionally includes only browser-safe Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Do not place service-role, database, or backend-only keys in `web/`.

## Commands

```bash
pnpm --dir web dev
pnpm --dir web lint
pnpm --dir web typecheck
pnpm --dir web build
pnpm --dir web format
pnpm --dir web supabase:types
```

## Current Scope

This app has the Stage 1 foundation, authenticated operator shell, and the
first Phase 4 read-model slice. `/dashboard`, `/weeks`, and
`/weeks/[weekStart]` read real authenticated operational data through Supabase
SSR helpers and RLS-safe operator views.

Other operational routes remain deliberate placeholders until their read models
or audited write contracts land. No domain write Server Actions exist beyond
sign-in and sign-out.
