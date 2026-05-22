# AGENTS.md

## Project Mission

Build a robust catering operations system for Padea that handles weekly school tutoring meal ordering from source data ingestion through order generation, validation, delivery readiness, and operator review.

This is not just an email automation project. The system must make catering better: correct quantities, safe exclusion handling, less coordinator effort, better student fit, and a visible audit trail.

## Core Tech Stack

- UI Frontend: Streamlit
- Database & State: Supabase/PostgreSQL
- Orchestration Engine: Native Python
- LLM: To be decided after testing
- Package Layout: `src/padea_catering/`

## Non-Negotiables

- Raw source files in `data/raw/` are immutable.
- Supabase/PostgreSQL is the operational source of truth.
- Streamlit is only the operator interface; business logic belongs in `src/padea_catering/`.
- Do not silently patch around messy data.
- Record unresolved ambiguity in `docs/EDGE_CASES.md`.
- Prefer deterministic Python rules over LLM judgement for quantities, absences, exclusions, and order generation.
- LLMs may assist with parsing, summarisation, explanations, and draft communications, but they must not be the sole authority for safety-critical catering decisions.
- Every generated order should be reproducible from database state.
- Every manual override should preserve a reason and timestamp.

## Common Commands

Install dependencies:

```bash
uv sync
````

Run Streamlit:

```bash
uv run streamlit run app/streamlit_app.py
```

Run tests:

```bash
uv run pytest
```

Lint:

```bash
uv run ruff check .
```

Format:

```bash
uv run ruff format .
```

Sync skills:

```bash
uv run python scripts/sync_skills.py
```

## Repository Boundaries

* `app/`: Streamlit UI only.
* `src/padea_catering/`: core application logic.
* `src/padea_catering/ingestion/`: parse and normalise source files.
* `src/padea_catering/ordering/`: attendance resolution, menu filtering, meal allocation, and order generation.
* `src/padea_catering/validation/`: preflight checks and system invariants.
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

Before declaring work complete:

1. Update relevant docs.
2. Add or update tests.
3. Run formatting.
4. Run tests.
5. Record unresolved edge cases.

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

Implementation: Streamlit UI backed by Supabase queries and explicit action functions.

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

````

## Verdict

Your version is fine to keep as `docs/LLM_ARCHITECTURE.md`.

For `AGENTS.md`, use the version above or merge its repo-operating sections into yours. The main missing pieces were:

```text
commands
repo boundaries
raw-data immutability
deterministic-vs-LLM rules
testing expectations
edge-case recording rules
````