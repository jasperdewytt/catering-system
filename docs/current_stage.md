# Current Project Stage

_Update this file whenever a significant phase completes or the active focus shifts._

## Status: Phase 3 Communications Persistence Implemented — Live Sending Deferred

**Last updated**: 2026-05-23

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
- [x] `docs/EDGE_CASES.md` written — 24 edge cases (E-01..E-24): E-09 and E-16 now resolved by D-11/D-12, E-23 updates D-03, E-02 resolved on inspection, E-06 deferred, remaining cases open
- [x] `docs/DECISIONS.md` written — D-01..D-13 decided (student PK, exclusion model, day column, null dietary, multi-session, opt-out, menu-item count, deterministic dietary matching, customisable dish variants, approval/audit, synthetic contact anomalies, delivery-location granularity, export-vs-send semantics)
- [x] Supabase project connected (`fogxaakhlpqnjmznyurm`) and MCP authenticated
- [x] **Phase 1 schema applied** — 14 source/validation tables across 7 migrations in `supabase/migrations/`:
  - `20260522120000_extensions_and_helpers.sql` — pgcrypto, citext, trigger fn, 3 enum types
  - `20260522120100_schools_and_caterers.sql` — schools, school_aliases, caterers, caterer_weekly_minimums, caterer_contacts
  - `20260522120200_sessions_and_exclusions.sql` — sessions, exclusions
  - `20260522120300_students_and_diets.sql` — students, dietary_tags (11 seeded), student_dietary_tags, student_dietary_warnings
  - `20260522120400_enrolments_dishes_absences.sql` — session_enrolments, dishes, absences
  - `20260522120500_move_citext_to_extensions_schema.sql` — security advisor fix (later reverted)
  - `20260522180000_revert_citext_to_public.sql` — revert citext-schema move because PostgREST expects `public.citext`
- [x] Advisors reviewed: RLS-no-policy INFOs are intentional until operator UI policies exist; unused-index INFOs are expected on a small/new schema; `citext` remains in `public` by deliberate PostgREST compatibility revert.
- [x] **Python package initialised** — `pyproject.toml` with `pandas`, `openpyxl`, `pdfplumber`, `supabase<2.30`, `python-dotenv`, `pydantic`, `streamlit`; dev deps `pytest`, `ruff`. Python pinned to `>=3.12,<3.14` (avoid pyiceberg-on-3.14 C-build).
- [x] **Ingestion pipeline complete** — `uv run python -m padea_catering.ingestion` populates the 14 source/validation tables in one pass, idempotently. Verified row counts:
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
- [x] **Phase 1 validation preflight complete** — before Phase 2 menu-offer checks, `uv run python -m padea_catering.validation` reported 0 errors, 15 warnings, 12 info.
  - E-04 caterer minimums: all 4 caterers' forecasts satisfy their minimums (Lakehouse 16 up to 4-item, others 6-item).
  - E-16 building-only delivery locations: resolved by D-12; room numbers are expected to be absent and should not warn for this dataset.
  - D-05 multi-session same-date: 0 conflicts (Riley Turner is correctly two UUIDs).
  - E-09 suspicious emails: resolved by D-11; addresses are competition/synthetic fixture data, but communications should still snapshot recipients.
  - Empty session: ISHS-Thursday and LC-Tuesday are fully cancelled by exclusions (info, "no order needed"); 0 unexpected empties.
  - Dietary warning backlog: 0 pending.
- [x] **Phase 2 schema applied** — order-generation and variant tables across 3 migrations:
  - dish ingredient review fields (`contains_*`, `ingredient_flags_source`, review metadata)
  - `dish_variants` for concrete orderable options under a parent source dish
  - `menu_offers`
  - `order_runs`, `order_allocations`, `order_lines`, `order_allocation_issues`
  - `20260522201000_index_order_allocation_issue_fks.sql` covers nullable issue-table foreign keys
  - `20260522202000_dish_variants.sql` makes `menu_offers`, allocations, and order lines variant-aware
  - RLS enabled and anon/authenticated revoked, matching the existing service-role-only pattern
- [x] **Order generation implemented** — `uv run python -m padea_catering.ordering --week-start 2026-05-01 --dry-run` builds a deterministic plan without writing; normal mode writes blocked/generated order runs.
- [x] **Validation updated for Phase 2** — validation now checks `menu_offers`, offered variant review status, and ordering dry-run readiness. Current live validation has no blocking errors after operator menu review; remaining findings are operational warnings.
- [x] **Tests expanded** — unit tests cover normalisation helpers, deterministic ordering rules, and menu setup helper rules.
- [x] **Narrow Menu Setup MVP implemented** — `uv run streamlit run app/menu_setup_mvp.py` provides a temporary UI for:
  - creating concrete orderable variants for customisable dishes such as burritos
  - selecting weekly `menu_offers` per active caterer by variant
  - reviewing variant dietary/ingredient flags and saving `operator_reviewed` metadata
  - running validation and order-generation dry runs
- [x] **Generated order run achieved** — `order_run_id=9b23f6a1-38f1-4ec7-a933-d4f6a1d2d6f0`, `status=generated`, 320 allocations, 33 order lines, 0 issues.
- [x] **Narrow Order Review MVP implemented** — `uv run streamlit run app/order_review_mvp.py` provides a read-only/export-only UI for:
  - selecting generated order runs
  - reviewing order lines, allocations, contacts, and delivery notes
  - preparing deterministic copy-ready caterer email drafts
  - downloading draft text files
- [x] **Phase 3 approval/audit implemented** — order runs can be approved/reopened through audited backend actions. `audit_log` and `manual_overrides` provide the durable record path required before live sending or manual correction logic.
- [x] **Phase 3 communications persistence/export tracking implemented** — approved, issue-free runs can record caterer export events before any live sending. The first export per `(order_run_id, caterer_id)` creates an immutable communication snapshot with subject/body/rendered text, delivery notes, recipient snapshots, template version, actor/timestamps, and an audit-log row. Repeated exports reuse the snapshot and append export events. Export semantics are recorded in D-13: exported means prepared for manual sending, not sent.
- [x] **LLM integration plan written** — `docs/LLM_INTEGRATION_PLAN.md` defines advisory-only LLM use cases, forbidden safety-critical uses, provider boundaries, and the recommended order after communications persistence.

## Active Focus

**Final operator workflow and submission artefacts** after communications persistence.

The backend can write generated order runs, and the temporary order review MVP can inspect and approve those runs with an audit trail. Customisable parent dishes are split into concrete orderable variants before they are offered to restricted students. The implemented algorithm:

1. For each non-cancelled session, walk the enrolled students minus opted-out, year-excluded, and absent.
2. For each student, pick a safe offered variant given their dietary tags.
3. Aggregate per-session into variant-aware `order_lines`, per-student into `order_allocations`.
4. Reproducibility: the same DB state should always produce the same order_run output.

The current generated run has no allocation issues. Building-only delivery locations and suspicious/free-webmail caterer addresses are documented as expected competition-data artefacts, not blockers. Communications now preserve recipient snapshots and delivery-note content for audit before any live email sending is added.

## Up Next (in order)

1. Review/record exports for the approved run in the Order Review MVP
2. Streamlit final operator UI → `app/streamlit_app.py` (requires Phase 4 migrations: RLS policies + views)
3. Add email sending only after the operator confirms the persisted export workflow
4. (Optional Phase 3) `session_validation_findings` table to persist validation output
5. Submission artefacts

## Known schema follow-ups (Phase 2+)

- final UI replacement for `app/menu_setup_mvp.py` and `app/order_review_mvp.py` — the MVPs are intentionally separate from the future full app
- manual override application logic — Phase 3 records overrides but does not yet mutate generated allocations/order lines
- live email sending — intentionally deferred until persisted export snapshots have been operator-reviewed
- contact verification workflow is no longer a priority for the competition dataset; suspicious addresses should remain visible and auditable, but not block communications persistence
- LLM integration is planned but intentionally deferred until communications persistence exists; first likely LLM feature is advisory order-review storage
- `caterer_school_capacity` — E-06 deferred fallback routing data (Phase 2)
- `session_validation_findings` — preflight warning queue for E-04 and multi-session date conflicts (Phase 3)
- RLS policies + `security_invoker` views — once Streamlit auth shape is decided (Phase 4)

## Parking Lot

- Skills under `skills/` have not been written yet.
- Test suite covers `ingestion.normalisation`, pure `ordering.rules`, and menu setup helper rules; ingestion `pipeline.py`, Supabase-backed `ordering.generator`, UI actions, and `validation/` modules have no unit tests yet (they read/write the live DB; integration tests would be the natural fit).
