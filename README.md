# Padea Catering System

Operational catering system for weekly school tutoring meal ordering.

Current stage: **Stage 1 Next.js operator website scaffolded; Phase 4 RLS-safe read models are next.**

## Architecture

- **Operator UI** (`web/`): Next.js 16 App Router + TypeScript, shadcn/ui, Tailwind, `@supabase/ssr`. The final product surface.
- **Business logic** (`src/padea_catering/`): Python — ingestion, deterministic ordering, validation, audited backend operations.
- **Database** (`supabase/migrations/`): Supabase / PostgreSQL is the source of truth.
- **LLM**: provider-neutral, advisory only (see `docs/LLM_INTEGRATION_PLAN.md`).
- **Legacy MVP** (`app/`): Streamlit verification harnesses, retained until the Next.js app reaches parity.

## Run the Next.js operator UI

```bash
pnpm --dir web install
pnpm --dir web dev
```

The Next.js app currently provides the authenticated operator shell, login screen, planned routes, and polished placeholder pages. It does **not** read operational data yet; real dashboard, week, order, export, audit, caterer, and student data should wait for Phase 4 RLS-safe read models.

## Run the Python backend

```bash
uv sync
uv run python -m padea_catering.ingestion
uv run python -m padea_catering.validation
uv run python -m padea_catering.ordering --week-start 2026-05-01 --dry-run
```

## Legacy Streamlit MVPs (verification only)

```bash
uv run streamlit run app/menu_setup_mvp.py
uv run streamlit run app/order_review_mvp.py
```

These pages are intentionally minimal and will be retired once `web/` reaches feature parity. Do not add new operator-facing features here.

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
