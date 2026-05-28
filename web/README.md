# Padea Operator Website

This folder contains the Next.js operator console for the catering workflow.
Operators use it to review weekly readiness, menu setup, generated orders,
caterer emails, students, caterers, validation summaries, and audit history.

## What You Need

- **Node.js 20+**
- **pnpm**, the JavaScript package manager used by this project

Recent Node.js versions include Corepack, which can enable `pnpm`:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Environment

Create a local web environment file:

```bash
cp web/.env.example web/.env.local
```

`web/.env.example` contains only browser-safe Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Do not put Supabase service-role keys, SMTP credentials, or other backend-only
secrets in client-side environment variables.

Some web actions call the Python backend to generate order runs or handle
caterer email records. Those server-side actions also need:

```bash
PADEA_BACKEND_URL=
PADEA_BACKEND_SHARED_SECRET=
```

The same `PADEA_BACKEND_SHARED_SECRET` must be configured in the Python backend
environment. The website never stores SMTP credentials. The current email send
path is test-routed through `PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE` in the Python
backend.

## Commands

Install dependencies:

```bash
pnpm --dir web install
```

Run locally:

```bash
pnpm --dir web dev
```

Check the app:

```bash
pnpm --dir web lint
pnpm --dir web typecheck
pnpm --dir web build
```

Other useful commands:

```bash
pnpm --dir web format
pnpm --dir web supabase:types
```

## Current App Coverage

The app includes:

- authenticated operator shell and sign-in
- dynamic next-step workflow guidance
- dashboard and week overview
- menu setup and reviewed dish variants
- validation summary page
- order generation, order review, approval, reopen, and follow-up notes
- caterer email snapshot review and safety-gated sending
- caterer and student inspection pages
- audit event search and detail review

The browser UI displays and requests stored operational records. The Python
backend remains responsible for order generation, allocation, dietary matching,
absence/exclusion handling, quantity calculation, communication rendering, and
email provider access.
