# Padea Catering System

Padea runs tutoring sessions across multiple schools and needs to order meals
from several caterers each week. This project is an operations system for that
workflow. It turns source spreadsheets and PDFs into reviewable weekly orders,
delivery notes, caterer email records, and an audit trail.

The main idea is simple: the system should not just send emails. It should help
make sure the order behind each email is correct.

## What The System Handles

- Ingests student, session, caterer, menu, absence, and exclusion source files.
- Preserves the original raw files and writes normalised records to
  Supabase/PostgreSQL.
- Applies deterministic rules for attendance, opt-outs, exclusions, dietary
  restrictions, dish variants, and quantities.
- Generates one meal allocation for each eligible attending student.
- Aggregates allocations into caterer order lines and delivery notes.
- Gives operators a web console to review readiness, menus, generated orders,
  student/caterer context, caterer emails, and audit history.
- Records operator decisions with actor, reason, and timestamp metadata.

## Architecture

- **Operator web app**: `web/` contains the Next.js 16 App Router application.
  It is the primary interface for reviewing and operating the weekly workflow.
- **Python backend**: `src/padea_catering/` contains ingestion, validation,
  order generation, email preparation/sending support, and backend-only audited
  operations.
- **Database**: `supabase/migrations/` defines the Supabase/PostgreSQL schema,
  read views, RPC contracts, audit tables, and communication records.
- **AI/LLM plan**: `docs/LLM_INTEGRATION_PLAN.md` describes future advisory AI
  support. Safety-critical decisions such as allergies, absences, exclusions,
  and quantities stay rule-based.

## Demo Workflow

The intended review path through the app is:

1. **Dashboard** — inspect the active week, readiness state, next suggested
   workflow step, sessions, generated runs, and recent audit activity.
2. **Menu setup** — review caterer offers, create concrete dish variants for
   customisable meals, and confirm dietary/ingredient flags.
3. **Validation** — check readiness summaries and latest persisted order issues.
4. **Orders** — generate a weekly order run through the Python backend, then
   inspect order lines, student allocations, contacts, and delivery notes.
5. **Approval and notes** — approve or reopen runs and record follow-up or
   override intent with an audit reason.
6. **Caterer emails** — create or review saved email snapshots, inspect
   recipients and delivery notes, and use the test-recipient send path.
7. **Audit** — review order generation, approval, email preparation, send
   attempts, and manual decision history.

Important data edge cases are documented in `docs/EDGE_CASES.md`, including
missing student IDs, similar student names, partial year-level cancellations,
customisable dishes, opt-outs, date/day mismatches, building-only delivery
locations, and synthetic-looking caterer contacts.

## Reproducing Locally

You can read the code and run most tests without a live deployment. To run the
full operator workflow with real data, you need a Supabase project configured
with the migrations in this repository and the expected environment variables.

### Prerequisites

- **Python 3.12**: used by the backend package and tests.
- **uv**: the Python dependency and command runner. It creates the local virtual
  environment and runs Python commands with the right dependencies.
- **Node.js 20+**: used by the Next.js web app.
- **pnpm**: the JavaScript package manager used by `web/`. It is commonly
  enabled through Corepack, which ships with recent Node.js versions:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Backend Setup

Backend-only environment values are read from an untracked `.env` file in the
repository root:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PADEA_BACKEND_SHARED_SECRET=
PADEA_EMAIL_PROVIDER=gmail_smtp
PADEA_EMAIL_FROM=
PADEA_GMAIL_SMTP_USERNAME=
PADEA_GMAIL_SMTP_APP_PASSWORD=
PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE=
```

`SUPABASE_SERVICE_ROLE_KEY`, SMTP credentials, and
`PADEA_BACKEND_SHARED_SECRET` are server-only secrets. Do not put them in
`web/` or commit real `.env` files.

Run backend commands:

```bash
uv sync
uv run python -m padea_catering.ingestion
uv run python -m padea_catering.validation
uv run python -m padea_catering.ordering --week-start 2026-05-01 --dry-run
uv run uvicorn padea_catering.backend:app --reload
```

The current email send path requires `PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE`.
Reviewed caterer emails are sent only to that test recipient while preserving
the intended caterer recipients in the audit/provider metadata.

### Web App Setup

Browser-safe Supabase values live in `web/.env.local`. Start from the example:

```bash
cp web/.env.example web/.env.local
```

`web/.env.example` contains:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Server-side web actions that ask the Python backend to generate orders or handle
caterer email records also need:

```bash
PADEA_BACKEND_URL=
PADEA_BACKEND_SHARED_SECRET=
```

Run the web app:

```bash
pnpm --dir web install
pnpm --dir web dev
```

Then open the local URL printed by Next.js, usually `http://localhost:3000`.

## Verification Commands

```bash
uv run ruff check .
uv run pytest
pnpm --dir web lint
pnpm --dir web typecheck
pnpm --dir web build
```

## Where To Look

- `docs/current_stage.md` — current status and deferred production hardening.
- `docs/EDGE_CASES.md` — data issues found in the source files and how they are
  handled.
- `docs/DECISIONS.md` — design decisions behind the schema, ordering rules,
  audit model, and operator UI.
- `docs/DATA_INVENTORY.md` — inventory of the raw source files.
- `docs/WEBSITE_PLAN.md` — operator workflow and page reference.
- `docs/WEBSITE_DATA_CONTRACTS.md` — database views and write contracts used by
  the web app.
- `web/README.md` — focused setup notes for the Next.js app.
