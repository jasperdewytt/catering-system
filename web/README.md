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

Gmail SMTP credentials are configured only in the Python backend environment.
The website does not store or edit SMTP secrets. `PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE`
is required by the backend for the current safety-gated send path, so send
actions are test-routed until encrypted secret management and real-recipient
rollout are designed.

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

This app is the primary operator console. It has the authenticated shell with
dynamic next-step workflow guidance, real operational reads for dashboard,
weeks, menu setup, validation, orders, caterer emails, caterers, students, and
audit, plus searchable/sortable order-line and allocation tables.

Audited domain writes exist for menu setup, order-run generation, order-run
approval, order-run reopen, follow-up/override notes, caterer email
preparation, first persisted email snapshot creation, and safety-gated
test-recipient sending. Email snapshots, send attempts, and order generation go
through the narrow Python backend bridge so deterministic rendering,
allocation, dietary, absence, exclusion, quantity rules, provider credentials,
and service-role Supabase access stay outside Next.js.
