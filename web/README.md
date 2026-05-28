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

Do not expose service-role or database keys to `web/`, and do not commit
backend-only secrets.

Server-side caterer email snapshot creation and live email sending also require
server-only values in the deployment environment or an untracked local env file.
Website-triggered order generation uses the same backend bridge values:

```bash
PADEA_BACKEND_URL=
PADEA_BACKEND_SHARED_SECRET=
```

`PADEA_BACKEND_SHARED_SECRET` must match the Python backend's environment and
must never be referenced from client components. The Supabase service-role key
belongs only in the Python backend environment, not in `web/`.

Gmail SMTP credentials are configured only in the Python backend environment for
v1. The website does not store or edit SMTP secrets. `PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE`
is required by the backend so send actions are test-routed until encrypted secret
management and real-recipient rollout are designed.

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

This app has the Stage 1 foundation, authenticated operator shell with dynamic
next-step workflow guidance, and the
implemented Phase 4 menu setup plus order review slices. `/dashboard`,
`/weeks`, `/weeks/[weekStart]`, `/weeks/[weekStart]/menu`,
`/weeks/[weekStart]/orders`, and
`/weeks/[weekStart]/orders/[orderRunId]` read real authenticated operational
data through Supabase SSR helpers and RLS-safe operator views. Order review
includes searchable/sortable order-line and allocation tables.

Audited domain writes currently exist for menu setup, order-run approval,
order-run reopen, follow-up/override notes, caterer email preparation, and
test-routed caterer email sending. Missing caterer email snapshots and send
attempts go through the narrow Python backend bridge so deterministic email
rendering, provider credentials, and service-role Supabase access stay outside
Next.js. Order generation is also created through that bridge so allocation,
dietary, absence, exclusion, and quantity rules stay Python-owned.
