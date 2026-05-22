# Current Project Stage

_Update this file whenever a significant phase completes or the active focus shifts._

## Status: Validation Preflight Complete — Order Generation Next

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
- [x] **Python package initialised** — `pyproject.toml` with `pandas`, `openpyxl`, `pdfplumber`, `supabase<2.30`, `python-dotenv`, `pydantic`, `streamlit`; dev deps `pytest`, `ruff`. Python pinned to `>=3.12,<3.14` (avoid pyiceberg-on-3.14 C-build).
- [x] **Ingestion pipeline complete** — `uv run python -m padea_catering.ingestion` populates all 14 tables in one pass, idempotently. Verified row counts:
  - 6 schools (+ 1 alias for E-21 punctuation drift)
  - 4 caterers, 12 weekly minimums (4×3 menu-item tiers), 6 contacts
  - 11 sessions (no `day` column; D-03 with E-23 caveat)
  - 3 exclusions, including partial CHAC `[10, 12]` per D-02
  - 320 students, 7 opted-out, 61 dietary tags, 0 unrecognised warnings
  - 320 session_enrolments
  - 40 dishes (36 halal-inferred, 4 non-halal, 8 with no declared tags per E-13)
  - 10 absences resolved fail-loud per D-01
- [x] **E-23 surfaced**: source `day` and `date` columns don't match real calendar — DATA_INVENTORY's "day = strftime('%A')" claim was wrong. D-03 still holds (don't store `day`), but ingestion now uses the source `day_label` for sheet→session matching.
- [x] 26 unit tests passing on `padea_catering.ingestion.normalisation`. Ruff clean.
- [x] **Validation preflight complete** — `uv run python -m padea_catering.validation` queries the live DB and reports findings without writing. On the current data: 0 errors, 15 warnings, 12 info.
  - E-04 caterer minimums: all 4 caterers' forecasts satisfy their minimums (Lakehouse 16 up to 4-item, others 6-item).
  - E-16 missing rooms: 11 sessions (all of them — `room` column is currently unset).
  - D-05 multi-session same-date: 0 conflicts (Riley Turner is correctly two UUIDs).
  - E-09 suspicious emails: 4 free-webmail contacts flagged.
  - Empty session: ISHS-Thursday and LC-Tuesday are fully cancelled by exclusions (info, "no order needed"); 0 unexpected empties.
  - Dietary warning backlog: 0 pending.

## Active Focus

**Order generation** in `src/padea_catering/ordering/`.

Now that the data is validated, the next phase is to actually generate orders. This needs new schema (Phase 2 migration): `menu_offers` (operator's per-week dish selection), `order_runs`, `order_lines`, `order_allocations`. Algorithm:

1. For each non-cancelled session, walk the enrolled students minus opted-out, year-excluded, and absent.
2. For each student, pick a safe dish from the offered menu given their dietary tags.
3. Aggregate per-session into `order_lines`, per-student into `order_allocations`.
4. Reproducibility: the same DB state should always produce the same order_run output.

## Up Next (in order)

1. Phase 2 migrations: `menu_offers`, `order_runs`, `order_lines`, `order_allocations`
2. Order generation / matchmaking → `src/padea_catering/ordering/`
3. (Optional Phase 3) `session_validation_findings` table to persist validation output
4. Streamlit operator UI → `app/streamlit_app.py` (requires Phase 4 migrations: RLS policies + views)
5. Submission artefacts

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
