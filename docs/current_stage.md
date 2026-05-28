# Current Project Stage

_Update this file whenever a significant phase completes or the active focus shifts._

## Status: Website Order Generation Bridge Implemented — UX And Advisory LLM Refinement Next

**Last updated**: 2026-05-28

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
- [x] `docs/DECISIONS.md` written — D-01..D-14 decided (student PK, exclusion model, day column, null dietary, multi-session, opt-out, menu-item count, deterministic dietary matching, customisable dish variants, approval/audit, synthetic contact anomalies, delivery-location granularity, communication-snapshot-vs-send semantics, Next.js operator UI)
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
- [x] **Narrow Menu Setup MVP implemented and superseded** — `app/menu_setup_mvp.py` provided the temporary UI for:
  - creating concrete orderable variants for customisable dishes such as burritos
  - selecting weekly `menu_offers` per active caterer by variant
  - reviewing variant dietary/ingredient flags and saving `operator_reviewed` metadata
  - running validation and order-generation dry runs
- [x] **Generated order run achieved** — `order_run_id=9b23f6a1-38f1-4ec7-a933-d4f6a1d2d6f0`, `status=generated`, 320 allocations, 33 order lines, 0 issues.
- [x] **Narrow Order Review MVP implemented and superseded** — `app/order_review_mvp.py` provided the temporary read-only/caterer-email-only UI for:
  - selecting generated order runs
  - reviewing order lines, allocations, contacts, and delivery notes
  - preparing deterministic copy-ready caterer email drafts
  - downloading draft text files
- [x] **Phase 3 approval/audit implemented** — order runs can be approved/reopened through audited backend actions. `audit_log` and `manual_overrides` provide the durable record path required before live sending or manual correction logic.
- [x] **Phase 3 communications persistence implemented** — approved, issue-free runs can record send-ready caterer email snapshots before any live sending. The first persisted snapshot per `(order_run_id, caterer_id)` captures subject/body/rendered text, delivery notes, recipient snapshots, template version, actor/timestamps, and an audit-log row. Repeated recordings reuse the snapshot and append events. D-13 now separates internal snapshot/audit tokens from operator-facing "Caterer emails" language.
- [x] **Approved-run caterer email workflow verified** — the approved zero-issue run has persisted email snapshots for all four caterers, with recipient snapshots, email preparation events, and matching `communication_exported` audit-log rows.
- [x] **LLM integration plan written** — `docs/LLM_INTEGRATION_PLAN.md` defines advisory-only LLM use cases, forbidden safety-critical uses, provider boundaries, and the recommended order after communications persistence.
- [x] **Operator UI direction decided** — see [D-14](DECISIONS.md#d-14---operator-ui-is-nextjs--supabase-not-streamlit). The final operator interface is Next.js 16 + TypeScript in `web/`, using shadcn/ui, Tailwind, and `@supabase/ssr`. Streamlit MVPs in `app/` are now deprecated after operator-confirmed parity.
- [x] **Operator UI planning tightened after architecture review** — `docs/WEBSITE_IMPLEMENTATION_STAGES.md` now stages the build, `docs/WEBSITE_DATA_CONTRACTS.md` maps screens to views/write contracts, and D-15..D-17 decide operator identity, active-week derivation, and audited website write boundaries.
- [x] **Stage 1 operator website foundation scaffolded** — `web/` now contains a Next.js 16 App Router TypeScript app with Tailwind, shadcn-compatible primitives, Supabase SSR auth helpers, `/login`, protected operator shell routes, and Phase 4 read-model placeholders. The shell has no operational browser reads and no domain writes beyond Supabase Auth sign-in/sign-out.
- [x] **Phase 4 first read-model slice implemented** — `public.operators` now maps Supabase Auth users to durable operator display names; authenticated operator RLS policies guard the operational tables needed by the first website slice; `operator_current_week`, `operator_weeks`, `operator_week_status`, `operator_week_sessions`, `operator_order_runs`, and `operator_audit_events` are `security_invoker` views for Dashboard and Weeks. `audit_log.action` now permits the future menu setup audit tokens from D-17.
- [x] **Demo operator profile seeded for the existing Auth user** — `public.operators.display_name = 'Padea Operator'` is present for the existing Supabase Auth account. Credentials remain outside source control.
- [x] **First real website reads wired** — `/dashboard`, `/weeks`, and `/weeks/[weekStart]` now read Supabase through SSR helpers and typed read-model wrappers. Other routes remain deliberate placeholders until their read models or audited write contracts land.
- [x] **Phase 4 type surface regenerated** — `web/types/supabase.ts` is generated from the linked Supabase project and includes the full current database type surface.
- [x] **Phase 4 advisors reviewed** — remaining security advisor items are deferred-table `rls_enabled_no_policy` INFOs for tables not exposed in the first read slice, the deliberate `citext` in `public` warning, and the Supabase Auth leaked-password-protection warning. Performance advisor items are unused-index INFOs on the small fixture database and are not being removed.
- [x] **Menu setup read models implemented** — `operator_menu_setup` and `operator_validation_summary` expose browser-safe menu setup rows, configured caterer offer-count tiers, current offer metadata, variant review/availability fields, and stored menu-readiness findings without recalculating allocation, absence, quantity, or dietary matching logic.
- [x] **Audited menu setup RPCs implemented** — `operator_create_dish_variant`, `operator_review_dish_variant`, `operator_update_dish_variant_availability`, and `operator_save_menu_offers` require Supabase Auth plus a matching `public.operators` row, enforce reason text, validate offer-set invariants transactionally, and write menu audit-log rows.
- [x] **Next.js menu setup workflow wired** — `/weeks/[weekStart]/menu` now reads real menu setup data and supports custom variant creation, dietary/ingredient review, availability changes, and caterer offer-set saves through Zod-validated Server Actions backed by the audited RPCs.
- [x] **Menu setup security checks reviewed** — anonymous reads/RPC calls are denied; authenticated non-operators see no menu rows and cannot write; direct `authenticated` table writes are not granted for `dish_variants` or `menu_offers`. Supabase advisor now reports the four menu RPCs as authenticated `SECURITY DEFINER` functions, which is intentional for the audited operator write boundary from D-17.
- [x] **Order review read models implemented** — `operator_order_run_lines`, `operator_order_run_allocations`, `operator_order_run_issues`, `operator_order_run_contacts`, and `operator_manual_overrides` expose persisted order-review facts, contacts, delivery notes, and override history without recalculating allocation, dietary, absence, or quantity logic in TypeScript.
- [x] **Audited order review RPCs implemented** — `operator_approve_order_run`, `operator_reopen_order_run`, and `operator_record_manual_override` require Supabase Auth plus a matching `public.operators` row, enforce reason text, update only permitted order-run states, record manual override intent without allocation mutation, and write central audit-log rows.
- [x] **Next.js order review workflow wired** — `/weeks/[weekStart]/orders` and `/weeks/[weekStart]/orders/[orderRunId]` now read real order run data and support approval, reopen, and manual override intent through Zod-validated Server Actions backed by audited RPCs.
- [x] **Order review usability refined** — order-line and allocation tables now support search, filters, counts, reset controls, and sortable headers. The override-note form uses human-readable allocation/order-line/contact selectors instead of raw UUID entry, while still submitting row ids internally to the audited RPC.
- [x] **Caterer email web workflow implemented** — `/weeks/[weekStart]/exports` now reads real communication snapshots through `operator_communications`, `operator_communication_recipients`, and `operator_communication_events`; displays persisted recipients, rendered text, delivery notes, and email-preparation history; creates missing first snapshots through the narrow Python backend bridge; and records repeat email-preparation events through the audited `operator_record_caterer_email_preparation` RPC without rendering Python-owned templates in TypeScript.
- [x] **Stage 8 advisors reviewed** — Supabase now reports `operator_record_caterer_email_preparation` as an authenticated `SECURITY DEFINER` function, which is intentional for the audited operator write boundary from D-17. Other remaining security/performance advisor items are the previously documented deferred-table RLS INFOs, deliberate `citext` warning, Auth leaked-password warning, and unused-index INFOs on the small fixture database.
- [x] **Audit read page implemented** — `/audit` now reads `operator_audit_events` through the typed Supabase SSR helper, shows summary counts, provides search/action/actor/entity filters, links order-run audit rows back to order details, and exposes before/after JSON snapshots without adding writes or recomputing domain logic.
- [x] **Validation read page implemented** — `/weeks/[weekStart]/validation` reads `operator_week_status`, `operator_validation_summary`, `operator_order_runs`, and latest `operator_order_run_issues` through the typed Supabase SSR helper. The page shows stored readiness summaries and latest persisted allocation issues without triggering Python jobs, adding writes, or claiming full validation-history coverage before `session_validation_findings` exists.
- [x] **Caterer read pages implemented** — `operator_caterers` and `operator_caterer_detail` are browser-safe `security_invoker` views for caterer directory/detail inspection. `/caterers` and `/caterers/[catererId]` now show assigned schools, contacts, weekly minimums, stored menu review counts, latest persisted order totals, and communication readiness without contact-verification writes or TypeScript recomputation of catering rules.
- [x] **Student read pages implemented** — `operator_students` and `operator_student_detail` are browser-safe `security_invoker` views for student directory/detail inspection. `/students` and `/students/[studentId]` now show profile/contact fields, opt-out state, stored dietary tags and warnings, enrolments, absences, latest persisted allocations, and relevant override/audit context without student edits or TypeScript recomputation of attendance, exclusions, dietary safety, allocation, or quantities.
- [x] **Narrow caterer-email Python bridge implemented** — FastAPI `POST /internal/caterer-email-snapshots` calls Python-owned `record_communication_export(...)` with service-role Supabase access behind `PADEA_BACKEND_SHARED_SECRET`. `/weeks/[weekStart]/exports` now lets operators create missing immutable snapshots through a Zod-validated Server Action while repeat preparation events still use the existing audited RPC.
- [x] **Narrow order-generation Python bridge implemented** — FastAPI `POST /internal/order-runs` calls Python-owned `generate_order_run(...)` with service-role Supabase access behind `PADEA_BACKEND_SHARED_SECRET`. `/weeks/[weekStart]/orders` now lets operators create a persisted run through a Zod-validated Server Action, refreshes affected week/order/validation/export/audit routes, and records `order_run_generated` with actor, reason, counts, week start, and prior supersedable run ids.
- [x] **Missing snapshot web path manually verified** — a fresh approved, issue-free order run was created, `/weeks/2026-05-01/exports` showed `not_exported` caterer cards, and creating a first snapshot from the website refreshed the card into the persisted email-ready preview.
- [x] **Next.js parity confirmed by operator review** — the website can replace the old Streamlit MVPs for menu setup, order review/approval, persisted caterer email preparation, audit inspection, validation summary review, caterer inspection, and student inspection.
- [x] **Streamlit MVPs retired in project direction** — `app/menu_setup_mvp.py` and `app/order_review_mvp.py` are no longer active operator surfaces. They remain in the tree only as deprecated historical harnesses until a separate cleanup removes the files and dependency.

## Active Focus

**Refine the Next.js operator UX and plan advisory LLM features while preserving deterministic catering rules.**

The deterministic Python backend can write generated order runs end-to-end, and the website can now request that narrow generation path without shelling out or reimplementing ordering rules. Communications persistence captures recipient snapshots and email preparation events. The Next.js website is now the primary operator interface and has replaced the Streamlit MVP workflow. The implemented allocation algorithm remains:

1. For each non-cancelled session, walk the enrolled students minus opted-out, year-excluded, and absent.
2. For each student, pick a safe offered variant given their dietary tags.
3. Aggregate per-session into variant-aware `order_lines`, per-student into `order_allocations`.
4. Reproducibility: the same DB state should always produce the same order_run output.

The current approved fixture run has no allocation issues and the web caterer-email page can show persisted snapshots as email-ready. The manually verified bridge path also handles fresh approved runs with missing communication rows by creating the first immutable snapshot from the website. Website order generation creates a new persisted run and supersedes prior `blocked`/`generated` runs; it does not delete approved or historical runs. The menu setup view may surface stored offers on unavailable variants as blocking menu-readiness findings, which the web workflow can resolve by changing availability or saving a revised offer set with an audited reason. Building-only delivery locations and suspicious/free-webmail caterer addresses are documented as expected competition-data artefacts, not blockers. Communications preserve recipient snapshots and delivery-note content for audit before any live email sending or LLM-assisted wording is added.

## Up Next (in order)

1. **Collect and implement operator UX refinement notes** from real website use.
2. **Plan the first advisory LLM layer** without changing deterministic ordering, dietary, quantity, attendance, or approval rules.
3. Remove deprecated Streamlit files and the unused dependency in a separate cleanup if no historical reference is needed.
4. Live email sending only after the persisted caterer email workflow is operator-confirmed in `web/`.
5. Broader Python job bridge for ingestion or validation only after job status/audit semantics are designed.
6. `session_validation_findings` table to persist full Python validation output before live validation-history UI, if needed beyond the submission readiness summary.
7. Submission artefacts.

## Known schema follow-ups (Phase 2+)

- physical removal of deprecated Streamlit MVP files and the `streamlit` Python dependency; the website has parity, but this cleanup is intentionally separate from the docs/status update
- manual override application logic — Phase 3 records follow-up/override notes but does not yet mutate generated allocations/order lines
- audited individual meal editing — future backend/RPC contract should validate eligible replacement variants, update allocation and order-line facts transactionally, record before/after state, and mark the edited run as diverged from generated output
- live email sending — intentionally deferred until persisted email snapshots have been operator-reviewed in `web/`
- web-callable broader Python job bridge for ingestion and validation remains deferred; implemented FastAPI bridges are limited to caterer email snapshot creation and synchronous order generation
- contact verification workflow is no longer a priority for the competition dataset; suspicious addresses should remain visible and auditable, but not block communications persistence
- advisory LLM integration can now be planned on top of persisted order and communication records; likely first candidates are order review suggestions, email polish beside deterministic drafts, and operator-facing summaries
- `caterer_school_capacity` — E-06 deferred fallback routing data (Phase 2)
- `session_validation_findings` — persisted Python validation output for full validation-history UI; not required before Stage 1 scaffold

## Parking Lot

- Canonical website implementation skills now exist under `skills/`: `phase-4-supabase-read-model`, `build-operator-read-page`, and `audited-web-action`.
- Test suite covers `ingestion.normalisation`, pure `ordering.rules`, and menu setup helper rules; ingestion `pipeline.py`, Supabase-backed `ordering.generator`, UI actions, and `validation/` modules have no unit tests yet (they read/write the live DB; integration tests would be the natural fit).
- `web/` will need its own test strategy — Playwright for end-to-end, Vitest for unit/component, and a shared fixture seed against a Supabase branch DB. Defer wiring until the scaffold lands.
- Decide whether `web/` lives at the repository root or under a `web/` directory of a future pnpm workspace. Current direction: single Next.js project at `web/` for now; promote to a workspace only if a shared TypeScript package emerges.
- Keep the Python/Next.js boundary narrow: Next.js may perform explicit audited database writes through Server Actions, but Python-owned jobs should stay CLI/service-triggered unless a deliberate HTTP/queue bridge is added.
- UX refinement notes should be collected as concrete operator workflow friction: confusing states, excess clicks, missing cross-links, table density, copy clarity, mobile layout issues, and empty/error states. Implement them as small website slices rather than broad redesigns.
