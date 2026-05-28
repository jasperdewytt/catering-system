# AGENTS.md

## Project Mission

Build a robust catering operations system for Padea that handles weekly school tutoring meal ordering from source data ingestion through order generation, validation, delivery readiness, and operator review.

This is not just an email automation project. The system must make catering better: correct quantities, safe exclusion handling, less coordinator effort, better student fit, and a visible audit trail.

## Core Tech Stack

- **Operator UI (final)**: Next.js 16 (App Router) + TypeScript in `web/`
  - shadcn/ui + Radix primitives
  - Tailwind CSS
  - `@supabase/ssr` and `@supabase/supabase-js`
  - React Server Components + Server Actions
  - TanStack Query (client state) and TanStack Table (data grids)
  - React Hook Form + Zod for forms and validation
  - Sonner for toasts; Lucide for icons; Geist or Inter typography
- **Auth**: Supabase Auth (cookie-based SSR)
- **Database & State**: Supabase / PostgreSQL (source of truth)
- **Business Logic / Orchestration**: Native Python in `src/padea_catering/`
  - Batch CLI commands for ingestion, ordering generation, and validation
  - Reads/writes Supabase via the service-role key in backend-only contexts; never expose this key to `web/`
- **LLM**: provider-neutral adapter; advisory only. See `docs/LLM_INTEGRATION_PLAN.md`.
- **Retired MVP UI**: Streamlit apps under `app/` are deprecated historical harnesses. The Next.js app in `web/` is the operator surface.

## Non-Negotiables

- Raw source files in `data/raw/` are immutable.
- Supabase / PostgreSQL is the operational source of truth.
- The Next.js app in `web/` is the operator interface; all safety-critical business logic lives in `src/padea_catering/`. Next.js server actions and route handlers may orchestrate UI reads and explicit audited database writes, but they must not duplicate ordering, dietary, validation, ingestion, or allocation rules.
- Do not silently patch around messy data.
- Record unresolved ambiguity in `docs/EDGE_CASES.md`.
- Prefer deterministic Python rules over LLM judgement for quantities, absences, exclusions, and order generation.
- LLMs may assist with parsing, summarisation, explanations, and draft communications, but they must not be the sole authority for safety-critical catering decisions.
- Every generated order should be reproducible from database state.
- Every manual override should preserve a reason and timestamp.

## Common Commands

### Python backend (`src/padea_catering/`)

Install Python dependencies:

```bash
uv sync
```

Run ingestion (one-shot, idempotent):

```bash
uv run python -m padea_catering.ingestion
```

Run validation preflight:

```bash
uv run python -m padea_catering.validation
```

Generate weekly orders (dry-run shown):

```bash
uv run python -m padea_catering.ordering --week-start 2026-05-01 --dry-run
```

Run Python tests / lint / format:

```bash
uv run pytest
uv run ruff check .
uv run ruff format .
```

Sync skills:

```bash
uv run python scripts/sync_skills.py
```

### Next.js operator UI (`web/`)

Install web dependencies:

```bash
pnpm --dir web install
```

Run dev server:

```bash
pnpm --dir web dev
```

Production build / start:

```bash
pnpm --dir web build
pnpm --dir web start
```

Lint and typecheck:

```bash
pnpm --dir web lint
pnpm --dir web typecheck
```

Generate Supabase TypeScript types:

```bash
pnpm --dir web supabase:types
```

### Retired MVP (do not use or extend)

These are deprecated historical harnesses. New operator-facing functionality must land in `web/`.

## Repository Boundaries

* `web/`: Next.js 16 operator UI (App Router, TypeScript). The final product surface. See `web/README.md` once scaffolded.
  * `web/app/`: route segments and server components.
  * `web/components/`: presentational components (shadcn/ui-derived).
  * `web/lib/`: Supabase clients (`server.ts`, `client.ts`), shared utilities.
  * `web/actions/`: server actions that wrap deterministic backend operations.
  * `web/types/supabase.ts`: generated database types (do not edit by hand).
* `app/`: retired Streamlit MVPs (`menu_setup_mvp.py`, `order_review_mvp.py`) — deprecated historical harnesses, replaced by `web/`.
* `src/padea_catering/`: core Python application logic (batch and shared rules).
  * `src/padea_catering/ingestion/`: parse and normalise source files.
  * `src/padea_catering/ordering/`: attendance resolution, menu filtering, meal allocation, and order generation.
  * `src/padea_catering/validation/`: preflight checks and system invariants.
  * `src/padea_catering/operations/`: audited backend actions (approve/reopen, email preparation, override recording).
  * `src/padea_catering/llm/`: provider-neutral LLM adapters (advisory features only).
* `supabase/migrations/`: database schema changes.
* `data/raw/`: original source files; do not mutate.
* `data/interim/`: parsed intermediate outputs.
* `data/processed/`: clean import-ready data.
* `docs/`: requirements, edge cases, decisions, architecture, and demo notes.
* `skills/`: canonical agent skills.
* `.claude/skills/` and `.agents/skills/`: generated mirrors only.

## Development Rules

Before adding automation, check whether the process step should exist.

Before creating a new table, check whether it is a true entity, a relationship, or just a derived view.

Before using an LLM, ask whether the same decision can be made deterministically.

Keep `docs/current_stage.md` up to date. Update it whenever:
- A significant phase completes (inventory, schema, ingestion, validation, UI, etc.)
- The active focus shifts to a new area
- A major edge case is resolved or a decision is recorded

Before declaring work complete:

1. Update relevant docs.
2. Update `docs/current_stage.md` if the phase has changed.
3. Add or update tests.
4. Run formatting.
5. Run tests.
6. Record unresolved edge cases.

## Data Safety Rules

Never overwrite files in `data/raw/`.

When parsing source files, write outputs to `data/interim/`.

When normalising source files, write outputs to `data/processed/`.

When a value is inferred rather than directly present in the source material, preserve provenance or record the assumption in `docs/EDGE_CASES.md`.

## Conceptual Agent Roles

The system may be described using five conceptual agents. These are architectural roles, not necessarily separate autonomous runtime processes.

### 1. Ingestion Agent

Responsibility: Parse messy PDF menus, Excel student rosters, contact documents, exclusions, and absence records into structured relational data.

Implementation: Python ingestion pipeline, with optional LLM support only for ambiguous unstructured text.

### 2. Matchmaking Agent / Solver

Responsibility: Match active, non-absent students to caterer dishes while enforcing allergy, exclusion, and attendance rules.

Implementation: Deterministic Python first. LLM support may be used later for preference summarisation, not safety-critical allocation.

### 3. Logistics & Communications Agent

Responsibility: Generate order emails, delivery notes, and manager-facing summaries.

Implementation: Template-driven Python with optional LLM polish for human-readable wording.

### 4. Feedback & Quality Agent

Responsibility: Convert post-session feedback into structured caterer/menu quality signals.

Implementation: Structured form inputs first; LLM extraction only for free-text feedback.

### 5. Operational Co-Pilot

Responsibility: Let operators inspect order status, resolve validation issues, and make manual overrides.

Implementation: Next.js 16 App Router UI in `web/`. Server components and server actions call Supabase directly for RLS-protected reads, and use explicit audited database contracts for simple operator writes. Deterministic jobs such as ingestion, validation, and order generation stay in `src/padea_catering/`; if the UI needs to trigger them live, add a small HTTP/queue bridge rather than importing Python from Next.js.

## Skills

Canonical skills live in `skills/`.

Do not edit `.claude/skills/` or `.agents/skills/` directly. They are generated mirrors.

After changing any skill, run:

```bash
uv run python scripts/sync_skills.py
```

Recommended skills:

* `ingest-resource-pack`
* `design-supabase-schema`
* `generate-weekly-orders`
* `validate-catering-run`
* `prepare-submission-artifacts`
* `phase-4-supabase-read-model`
* `build-operator-read-page`
* `audited-web-action`

## Frontend Conventions (`web/`)

* Default to **React Server Components**. Drop into client components only for interactivity, forms, optimistic UI, or hooks.
* All writes go through **Server Actions**. Simple operator actions may use typed TypeScript wrappers around audited SQL contracts; Python-owned jobs (ingestion, validation, order generation) remain CLI/service operations unless a deliberate HTTP/queue bridge is added. Server actions must record actor and reason where the domain requires it (approval, override, email preparation).
* Use `@supabase/ssr` for the server Supabase client and `@supabase/supabase-js` only inside client components.
* Keep Supabase SSR setup isolated behind `web/lib/supabase/*` and pin package versions; auth helper APIs can change.
* RLS is the security boundary, not React state. Anonymous reads are forbidden until Phase 4 RLS policies land.
* Use **shadcn/ui** components as the base layer; do not pull in additional component libraries (Material UI, Chakra, Mantine, etc.).
* Style with **Tailwind**. No CSS-in-JS, no inline `style` props except for dynamic values that cannot be expressed as classes.
* Forms use **React Hook Form + Zod**; the same Zod schema validates the server action body.
* Data grids use **TanStack Table**. Long lists virtualise.
* Generated Supabase types live at `web/types/supabase.ts`. Regenerate after every migration.
* Loading and empty states are first-class. Never ship a route without `loading.tsx` and a deliberate empty state.

## Git workflow

See @GIT_WORKFLOW.md
