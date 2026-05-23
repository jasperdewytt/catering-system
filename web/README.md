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

This is Stage 1 with a narrow static Stage 2/3 shell. The app authenticates
with Supabase Auth, renders `/dashboard` and the planned route structure, and
shows explicit Phase 4 placeholders for data-backed pages.

No operational tables or views are queried from the shell. No domain write
Server Actions exist beyond sign-in and sign-out.
