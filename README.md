# Padea Catering Autopilot

An operations platform that turns messy school catering data into safe, auditable weekly meal orders — then handles routine follow-up automatically.

Built for the **Padea Operations Engineer Competition**, this project combines a Next.js operator console, a deterministic Python ordering engine, Supabase/PostgreSQL, and the **Anthropic Claude API**. It was developed with help from Claude.

## Product tour

### Weekly operations dashboard

![Weekly operations dashboard](docs/screenshots/dashboard.png)

See the active service week, delivery schedule, order readiness, automation status, and recent activity in one place.

### Catering Autopilot

![Catering Autopilot](docs/screenshots/autopilot.png)

Run a normal week end to end, track durable background jobs, review caterer replies, and surface only the cases that need a person.

### Feedback and quality loop

![Feedback and quality dashboard](docs/screenshots/feedback.png)

Turn signed student and session-manager feedback into structured meal preferences and caterer quality signals for future weeks.

## What makes it interesting

- **Real operational scope:** ingests spreadsheets and PDFs covering 307 students, 11 tutoring sessions, 5 schools, 4 caterers, and 40 menu dishes in the competition dataset.
- **Safety before optimisation:** dietary restrictions, absences, exclusions, attendance, and quantities are handled by deterministic Python rules before preference scoring begins.
- **Exception-based automation:** clean weeks can progress from offer selection to generated orders and prepared communications without operator input.
- **Claude with clear boundaries:** the Claude API converts unstructured caterer replies and feedback into schema-constrained interpretations. Python remains the authority for dietary safety, replacements, quantities, approval, and sending.
- **Safe reply handling:** clean confirmations can resolve automatically, while a narrowly defined unavailable-item workflow can create a checked replacement order. Ambiguous or unsafe replies become reviewable exceptions.
- **Preference-aware ordering:** feedback, meal-fit history, novelty, and caterer quality influence future selections only after every safety filter passes.
- **Designed for retries:** queued jobs, email preparation, approvals, reply processing, and revised orders use idempotency controls to avoid duplicate actions.
- **Auditable by default:** automated actions, AI interpretations, operator decisions, email snapshots, and order revisions retain their source, reason, and timestamp.

## How it works

```text
Source spreadsheets and PDFs
           │
           ▼
  Python ingestion pipeline
           │
           ▼
 Supabase / PostgreSQL  ◄──── Next.js operator console
           │
           ▼
Deterministic validation and ordering
           │
           ▼
 Autopilot, communications, and feedback
           │
           ├── Safe and clear ──► continue automatically
           └── Risk or ambiguity ► operator exception
```

The same database state produces the same order facts. Claude supplies structured advice where language is ambiguous; it does not replace the deterministic safety layer.

## Architecture

| Layer              | Technology                                                | Responsibility                                                                      |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Operator interface | Next.js 16, TypeScript, React Server Components, Tailwind | Weekly status, menus, orders, approvals, exceptions, feedback, and audit history    |
| Business logic     | Python 3.12, FastAPI, Pydantic                            | Ingestion, validation, allocation, meal-fit scoring, communications, and automation |
| Data and auth      | Supabase, PostgreSQL, Row Level Security                  | Operational source of truth, operator access, read models, RPCs, and audit records  |
| AI integration     | Anthropic Claude API                                      | Schema-constrained reply and feedback interpretation with recorded provenance       |
| Background work    | Durable Python worker                                     | Autopilot runs, reply polling, feedback delivery, leases, retries, and job events   |

The repository keeps the main boundaries deliberate:

- `src/padea_catering/` owns safety-critical and operational logic.
- `web/` is the Next.js operator experience; it does not reimplement catering rules.
- `supabase/migrations/` defines the database, RLS policies, read views, and audited write contracts.
- `data/raw/` contains immutable competition source files.
- `docs/` records design decisions, edge cases, data provenance, and implementation stages.

## Claude integration

The backend uses the Anthropic SDK through an `AnthropicClaudeProvider`. Requests use structured JSON output, local Pydantic validation, stop-reason checks, and persisted provenance.

Claude is used for:

- interpreting free-text caterer replies;
- extracting preference and quality signals from written feedback;
- helping an operator turn an exception instruction into a proposed action.

Claude is not allowed to decide dietary safety, absences, exclusions, quantities, recipients, approvals, or whether an email is sent. Those decisions remain deterministic and testable.

## Run locally

You can inspect the code and run the test suite without external services. The complete operator workflow requires a configured Supabase project and local environment files.

### Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- pnpm
- Supabase project with the repository migrations applied

### Backend

Create an untracked root `.env` with the required backend values:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PADEA_BACKEND_SHARED_SECRET=
PADEA_FEEDBACK_LINK_SECRET=
PADEA_WEB_PUBLIC_URL=http://localhost:3000
ANTHROPIC_API_KEY=
PADEA_CLAUDE_MODEL=
```

Then run:

```bash
uv sync
uv run python -m padea_catering.ingestion
uv run python -m padea_catering.validation
uv run uvicorn padea_catering.backend:app --reload
```

### Operator console

Copy `web/.env.example` to `web/.env.local`, add the browser-safe Supabase values and backend bridge configuration, then run:

```bash
pnpm --dir web install
pnpm --dir web dev
```

Open `http://localhost:3000`. Operator routes require a Supabase Auth account linked to `public.operators`.

> [!NOTE]
> Outbound email is intentionally restricted to a configured test-recipient override. Real-recipient rollout is outside the competition build.

## Verification

```bash
uv run ruff check .
uv run pytest
pnpm --dir web lint
pnpm --dir web typecheck
pnpm --dir web build
```

The test suite covers ingestion normalisation, deterministic ordering, meal-fit selection, autopilot idempotency, Claude response validation, reply threading and revisions, feedback processing, exception resolution, and backend bridges.

## Further reading

- [`docs/current_stage.md`](docs/current_stage.md) — current implementation status and known follow-ups
- [`docs/EDGE_CASES.md`](docs/EDGE_CASES.md) — source-data issues and how they are handled
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — architecture and domain decisions

## Competition and authorship

This project was created for the **Padea Operations Engineer Competition**. I designed and implemented the system with help from Claude, and the application itself integrates the Anthropic Claude API for bounded language-understanding tasks.
