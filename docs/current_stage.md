# Current Project Stage

_Update this file whenever a significant phase completes or the active focus shifts._

## Status: Schema Applied — Ingestion Pipeline Next

**Last updated**: 2026-05-22

---

## Completed

- [x] Repository scaffolded (`pyproject.toml`, `app/`, `src/padea_catering/`, `.gitignore`, etc.)
- [x] `AGENTS.md` and `GIT_WORKFLOW.md` established
- [x] All 7 raw source files read and inventoried:
  - `data/raw/students.xlsx` — 11 sheets, 320 student-session rows, 307 unique students
  - `data/raw/sessions.xlsx` — 11 sessions, 4 caterers, 5 schools, week of 2026-05-01..04
  - `data/raw/caterers.xlsx` — 4 caterers with weekly order minimums
  - `data/raw/caterer-menus.pdf` — 40 dishes across 4 caterers with dietary flags
  - `data/raw/caterer-contacts.pdf` — primary/secondary contacts, cc preferences, school assignments
  - `data/raw/exclusions.pdf` — 3 session cancellations (1 partial by year-level)
  - `data/raw/absences.pdf` — 10 individual student absences across 6 school/date groups
- [x] `docs/DATA_INVENTORY.md` written — field names, types, row counts, samples, cross-file reference map
- [x] `docs/EDGE_CASES.md` written — 22 open edge cases (E-01..E-22) with proposed stances
- [x] `docs/DECISIONS.md` written — D-01..D-07 decided (student PK, exclusion model, day column, null dietary, multi-session, opt-out, menu-item count)
- [x] Supabase project connected (`fogxaakhlpqnjmznyurm`) and MCP authenticated
- [x] **Schema applied** — 14 tables across 6 migrations in `supabase/migrations/`:
  - `20260522120000_extensions_and_helpers.sql` — pgcrypto, citext, trigger fn, 3 enum types
  - `20260522120100_schools_and_caterers.sql` — schools, school_aliases, caterers, caterer_weekly_minimums, caterer_contacts
  - `20260522120200_sessions_and_exclusions.sql` — sessions, exclusions
  - `20260522120300_students_and_diets.sql` — students, dietary_tags (11 seeded), student_dietary_tags, student_dietary_warnings
  - `20260522120400_enrolments_dishes_absences.sql` — session_enrolments, dishes, absences
  - `20260522120500_move_citext_to_extensions_schema.sql` — security advisor fix
- [x] Advisors clean: only intentional INFOs remain (RLS-no-policy by design until operator UI; unused indexes expected on empty schema)

## Active Focus

**Build the ingestion pipeline** in `src/padea_catering/ingestion/`.

The 14-table schema is now in place. Ingestion needs to:

1. Parse each of the 7 raw files into the corresponding tables.
2. Normalise school names via `school_aliases` (E-21).
3. Parse `Dietary` text into structured `student_dietary_tags`, with unrecognised values routed to `student_dietary_warnings` (D-04).
4. Resolve `(school, full_name, date)` → `(student_id, session_id)` for absences, failing loud on 0 or >1 match (D-01).
5. Compute `is_halal_inferred` per dish from absence of pork (E-19).
6. Preserve raw source rows in `source_row jsonb` columns for audit.

`pyproject.toml` is still empty — first step is `uv init` and adding dependencies (`pandas` / `openpyxl`, `pdfplumber`, `supabase-py`, `pydantic`).

## Up Next (in order)

1. Initialise `pyproject.toml` with `uv` and add ingestion dependencies
2. Ingestion pipeline → `src/padea_catering/ingestion/`
3. Validation preflight → `src/padea_catering/validation/`
4. Order generation / matchmaking → `src/padea_catering/ordering/` (will require Phase 2 migrations: `order_runs`, `order_lines`, `menu_offers`)
5. Streamlit operator UI → `app/streamlit_app.py` (will require Phase 4 migrations: RLS policies + views)
6. Submission artefacts

## Known schema follow-ups (Phase 2+)

- `order_runs`, `order_lines`, `order_allocations`, `menu_offers` — order generation tables (Phase 2)
- `manual_overrides`, `audit_log` — operator action audit (Phase 3, per AGENTS.md non-negotiables)
- `caterer_school_capacity` — E-06 deferred fallback routing data (Phase 2)
- `session_validation_findings` — preflight warning queue for E-04, E-16, multi-session date conflicts (Phase 3)
- RLS policies + `security_invoker` views — once Streamlit auth shape is decided (Phase 4)

## Parking Lot

- `README.md` is empty — fill in after the schema is stable.
- Skills under `skills/` have not been written yet.
- No tests exist yet; pytest is configured but has nothing to find.
