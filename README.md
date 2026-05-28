# Padea Catering System

Operational catering system for weekly school tutoring meal ordering. The
project turns messy school, student, caterer, absence, exclusion, and menu data
into reviewable weekly orders, delivery notes, and audited caterer email
workflows.

Current stage: **Next.js operator console is submission-ready; safety-gated email rollout and broader job bridges remain deferred.**

## What This System Does

- Ingests source spreadsheets and PDFs into Supabase/PostgreSQL while preserving
  the original raw files.
- Normalises students, sessions, caterers, absences, exclusions, dishes,
  dish variants, and dietary tags into operational records.
- Generates one allocation per eligible attending student, excluding opted-out,
  absent, and year-excluded students before ordering.
- Aggregates allocations into caterer order lines and delivery notes.
- Lets operators review menu setup, validation readiness, generated runs,
  student/caterer context, caterer emails, and the audit trail in a Next.js
  console.
- Records approvals, follow-up notes, email preparation, order generation, and
  test-routed send attempts with actor/reason/timestamp metadata.

## Architecture

- **Operator UI** (`web/`): Next.js 16 App Router + TypeScript, shadcn/ui, Tailwind, `@supabase/ssr`. The final product surface.
- **Business logic** (`src/padea_catering/`): Python — ingestion, deterministic ordering, validation, audited backend operations.
- **Database** (`supabase/migrations/`): Supabase/PostgreSQL stores the operational state and audit trail.
- **LLM**: provider-neutral, planned for advisory assistance only (see `docs/LLM_INTEGRATION_PLAN.md`).
- **Historical harnesses** (`app/`): Streamlit verification tools retained only as deprecated reference; the Next.js app is now the operator surface.

## Demo Workflow

The intended reviewer path through the app is:

1. **Dashboard** — confirm the active week, current readiness state, next
   workflow step, sessions, generated runs, and recent audit activity.
2. **Menu setup** — review caterer offers, create concrete dish variants for
   customisable meals, and confirm dietary/ingredient flags.
3. **Validation** — inspect readiness summaries and latest persisted allocation
   issues without recomputing catering rules in the browser.
4. **Orders** — generate a weekly order run through the Python backend bridge,
   then inspect order lines, per-student allocations, contacts, and delivery
   notes.
5. **Approval and notes** — approve or reopen runs and record follow-up/override
   intent through audited actions.
6. **Caterer emails** — create or review persisted email snapshots, inspect
   recipients and delivery notes, and use the safety-gated test-recipient send
   path.
7. **Audit** — review generation, approval, email preparation, send attempts,
   and manual decision history.

Key data edge cases are documented in `docs/EDGE_CASES.md`, including no source
student IDs, same/similar student names, partial year-level exclusions,
customisable dishes, opt-outs, date/day mismatches, building-only delivery
locations, and synthetic-looking caterer contacts.

## Run the Operator UI

```bash
pnpm --dir web install
pnpm --dir web dev
```

`web/.env.example` contains only browser-safe values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The Next.js app provides the authenticated operator shell, dynamic next-step
workflow guidance, and real authenticated reads for dashboard, weeks, menu
setup, order review, validation, audit, caterers, students, and caterer emails.
Audited writes exist for menu setup, order-run generation, approval/reopen,
follow-up/override notes, repeat email-preparation events, first caterer email
snapshot creation, and test-routed sending through the Python backend bridge.

## Run the Python backend

Backend-only environment values are read from the repository root `.env` file.
Do not put service-role keys, SMTP credentials, or shared backend secrets in
`web/`.

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

`PADEA_BACKEND_SHARED_SECRET` is any long random string shared with
the server-side website environment. Gmail SMTP uses `smtp.gmail.com:587` with
TLS and an app password. `PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE` is mandatory for
the current safety-gated send path, so reviewed caterer emails are sent only to
the configured test recipient. Do not commit real `.env` files.

```bash
uv sync
uv run python -m padea_catering.ingestion
uv run python -m padea_catering.validation
uv run python -m padea_catering.ordering --week-start 2026-05-01 --dry-run
uv run uvicorn padea_catering.backend:app --reload
```

## Verification Commands

```bash
uv run ruff check .
uv run pytest
pnpm --dir web lint
pnpm --dir web typecheck
pnpm --dir web build
```

## Historical Streamlit Harnesses

The old Streamlit tools in `app/` have been replaced by the Next.js operator UI
in `web/`. They are retained only as deprecated historical reference until a
separate cleanup removes them and the unused dependency. Do not use or
extend them for operator workflows.

## Documentation

- `AGENTS.md` — project rules, tech stack, repository boundaries, agent roles.
- `GIT_WORKFLOW.md` — branch, commit, and ignore conventions.
- `docs/current_stage.md` — authoritative project status and next steps.
- `docs/DECISIONS.md` — resolved design decisions (D-01 .. D-19).
- `docs/EDGE_CASES.md` — observed data edge cases (E-01 .. E-24).
- `docs/DATA_INVENTORY.md` — raw source field map.
- `docs/LLM_INTEGRATION_PLAN.md` — where LLMs may fit; what they must never decide.
- `docs/WEBSITE_PLAN.md` — implemented Next.js operator information architecture and page reference.
- `docs/WEBSITE_IMPLEMENTATION_STAGES.md` — historical website build record and safety boundaries.
- `docs/WEBSITE_DATA_CONTRACTS.md` — browser-safe data and write contract map.
- `docs/design.md` — design handoff index and production implementation notes.
