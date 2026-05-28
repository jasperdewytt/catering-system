# Padea Catering System

Operational catering system for weekly school tutoring meal ordering.

Current stage: **Next.js operator surface is primary; UX and advisory LLM refinement next.**

## Architecture

- **Operator UI** (`web/`): Next.js 16 App Router + TypeScript, shadcn/ui, Tailwind, `@supabase/ssr`. The final product surface.
- **Business logic** (`src/padea_catering/`): Python — ingestion, deterministic ordering, validation, audited backend operations.
- **Database** (`supabase/migrations/`): Supabase / PostgreSQL is the source of truth.
- **LLM**: provider-neutral, advisory only (see `docs/LLM_INTEGRATION_PLAN.md`).
- **Retired MVP** (`app/`): Streamlit verification harnesses retained only as deprecated historical reference; the Next.js app is now the operator surface.

## Run the Next.js operator UI

```bash
pnpm --dir web install
pnpm --dir web dev
```

The Next.js app currently provides the authenticated operator shell, dynamic next-step workflow guidance, and real authenticated reads for dashboard, weeks, menu setup, order review, validation, audit, caterers, students, and caterer emails. Audited writes exist for menu setup, order-run generation, order-run approval/reopen, follow-up/override notes, repeat email-preparation events, first caterer email snapshot creation, and test-routed live email sending through the narrow Python backend bridge.

## Run the Python backend

Backend-only environment values are read from the repository root `.env` file:

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
`web/.env.local`. Gmail SMTP uses `smtp.gmail.com:587` with TLS and an app
password. `PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE` is mandatory for v1, so reviewed
caterer emails are sent only to the configured test recipient. Do not commit
real `.env` files.

```bash
uv sync
uv run python -m padea_catering.ingestion
uv run python -m padea_catering.validation
uv run python -m padea_catering.ordering --week-start 2026-05-01 --dry-run
uv run uvicorn padea_catering.backend:app --reload
```

## Retired Streamlit MVPs

The old Streamlit MVPs in `app/` have been replaced by the Next.js operator UI
in `web/`. They are retained only as deprecated historical reference until a
separate cleanup removes them and the unused Streamlit dependency. Do not use or
extend them for operator workflows.

## Documentation

- `AGENTS.md` — project rules, tech stack, repository boundaries, agent roles.
- `GIT_WORKFLOW.md` — branch, commit, and ignore conventions.
- `docs/current_stage.md` — authoritative project status and next steps.
- `docs/DECISIONS.md` — resolved design decisions (D-01 .. D-17).
- `docs/EDGE_CASES.md` — observed data edge cases (E-01 .. E-24).
- `docs/DATA_INVENTORY.md` — raw source field map.
- `docs/LLM_INTEGRATION_PLAN.md` — where LLMs may fit; what they must never decide.
- `docs/WEBSITE_PLAN.md` — planned Next.js operator information architecture and page plan.
- `docs/WEBSITE_IMPLEMENTATION_STAGES.md` — staged website build plan and boundaries.
- `docs/WEBSITE_DATA_CONTRACTS.md` — browser-safe read model and write contract map.
- `docs/design.md` — design handoff index and production implementation notes.
