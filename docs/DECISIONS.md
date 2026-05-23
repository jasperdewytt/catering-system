# Decisions

Resolved edge cases and architecture decisions with rationale. Data edge-case decisions link back to the corresponding `E-NN` in `docs/EDGE_CASES.md`; architecture decisions may link to planning docs instead.

---

## D-01 - Student primary key strategy (E-01)

**Decision**: Surrogate UUID primary key on the `students` table.

`(school, full_name)` carries a soft unique constraint — a warning is raised at ingestion time if a duplicate pair is detected, but it does not hard-block the import. An operator must confirm that duplicates are genuinely two different people before any order is generated for that session.

Absence rows that match zero students, or more than one student after operator resolution, fail loud and require manual override.

**Why not natural key only**: The raw data happens to have no `(school, full_name)` collisions today, but same-name students at the same school are a real operational risk. A surrogate UUID handles future collisions gracefully without requiring a schema change.

---

## D-02 - Partial year-level exclusion model (E-03)

**Decision**: Model exclusions as `(session_id, excluded_year_levels[])` on an `exclusions` table.

- Empty array = no exclusion (row should not exist).
- Array containing all year levels present in the session = full cancellation.
- Partial cancellation = array of the excluded year levels only.

The order generator filters out any student whose year level appears in the exclusion array for their session.

**Why one model for both cases**: A separate full-cancellation table and a partial-exclusion table would split the same concept across two places. The array approach handles both uniformly and keeps the order generator logic simple.

---

## D-03 - Drop `day` column (E-11)

**Decision**: `day` is not stored in the schema. `date` is the authoritative column for delivery scheduling.

**Update (during ingestion)**: The original rationale ("`day` always matches `date.strftime('%A')`") turned out to be wrong — see [E-23](EDGE_CASES.md#e-23--day-and-date-columns-disagree-with-the-gregorian-calendar). `2026-05-02` is labelled Tuesday in the source but is actually a Saturday. The decision still stands — we don't store `day` in `sessions` — but the **ingestion pipeline reads the source `day` column** to match `students.xlsx` sheet labels (e.g. `"JPC - Tuesday"`) to sessions. Python's `strftime('%A')` would give the wrong answer for this dataset.

**Why the decision still holds**: the schema only needs the date for delivery, and downstream queries that want to display a weekday should still derive from the date (which describes when delivery happens in real-world time). The source `day` label is an operational sheet-naming artefact, not a calendrical fact worth persisting.

---

## D-04 - Null `Dietary` cell meaning (E-12)

**Decision**: Three-way interpretation at ingestion:

- `null` → no restriction; no warning raised.
- Recognised dietary tag (`Halal`, `Nut Free`, `No Beef`, etc.) → restriction recorded and applied to meal allocation.
- Unrecognised text → operator warning raised; order for that student is blocked until manually reviewed.

**Why not warn on null**: The majority of blanks (261/320) are almost certainly genuinely unrestricted students. Flagging all of them as unverified would create noise that obscures real issues. The risk is captured by warning on *unrecognised* text instead.

---

## D-05 - Multi-session enrolment model (E-14)

**Decision**: `session_enrolment` is a many-to-many join table between `students` and `sessions`. A validation rule flags any student UUID appearing in more than one session on the same date for operator review before the order runs.

**Note on Riley Turner**: The apparent same-date conflict (MBBC + ISHS-Tuesday, both 2026-05-02) is a name coincidence — confirmed two different people via different parent names, contact details, and school email domains. The UUID PK (D-01) correctly distinguishes them as separate rows.

**Why many-to-many**: Some students legitimately attend sessions at two different schools on different days. Flattening to one enrolment per student would lose valid data.

---

## D-06 - Opted-out students (E-15)

**Decision**: `opted_out boolean` lives on the `students` table, not `session_enrolment`.

Opt-out is a persistent attribute set at roster ingestion time. There is no weekly source feed that updates it, so per-session opt-out tracking is not meaningful with current data. Any change requires a manual operator override with a reason and timestamp.

Dietary restrictions are stored regardless of opt-out status — safety-relevant data is always kept (e.g. Lei Li has `Nut Free, No Shellfish` and is opted out; both facts are stored).

Opted-out students are excluded from meal counts and do not appear in generated orders.

---

## D-07 - Meaning of "menu item count" (E-17)

**Decision**: "Menu items" = number of distinct orderable options on the offered menu for that week, selected by the operator before the order is generated. The applicable minimum order quantity is determined by that count.

**Pending**: stakeholder confirmation. Treat this as the working assumption until confirmed.

**Why this interpretation**: The caterer needs to know upfront how many options to prepare, so the offered menu count (operator-controlled) is the operationally meaningful number, not the count of options that happen to be ordered.

**Phase 2 implementation note**: `menu_offers` is operator-owned state. The migration does not seed default offers; validation and order generation block until an operator-selected offer set exists for each active caterer.

---

## D-08 - Deterministic dietary matching and dish ingredient review (E-05, E-13, E-19)

**Decision**: Meal allocation is deterministic and must never rely on LLM judgement for dietary safety.

Known student dietary tags are matched against explicit orderable-option fields:

- `vegetarian` requires the orderable option's `is_vegetarian_option = true`.
- `nut_free` requires the orderable option's `is_nut_free = true`.
- `gluten_free` requires the orderable option's `is_gluten_free = true`.
- `dairy_free` requires the orderable option's `is_dairy_free = true`.
- `halal` requires the orderable option's `is_halal_inferred = true`.
- `excludes_beef`, `excludes_pork`, `excludes_red_meat`, `excludes_fish`, `excludes_shellfish`, and `excludes_seafood` require operator-reviewable ingredient flags on the orderable option before order generation is considered production-safe.

Unknown student dietary text remains fail-loud per D-04: ingestion creates a pending `student_dietary_warnings` row, and the student must not receive an automatic allocation until an operator resolves the warning with a reason and timestamp.

Dishes with `has_no_declared_tags = true` are treated as "no claim made", not safe-by-default. If their orderable option flags are still `unreviewed`, they may be offered to unrestricted students only. Phase 2 may use `keyword_inferred` ingredient flags as a deterministic development bridge for restricted students, but validation must warn until an operator changes the option to `operator_reviewed`. The Phase 2 schema now stores reviewable ingredient columns such as `contains_beef`, `contains_pork`, `contains_red_meat`, `contains_fish`, `contains_shellfish`, plus review metadata (`ingredient_notes`, `tags_reviewed_at`, `tags_reviewed_by`, and a review reason).

Before the operator review UI exists, name-keyword matching may be used only as a deterministic development stop-gap for obvious ingredient exclusions, following the same style as the existing halal inference (`pork`, `bacon`, etc.). Production order generation should prefer stored reviewed option flags over name-string guesses.

If no safe offered option remains for a student after all filters run, the order generator records an allocation issue for operator intervention and does not silently assign a meal.

**Why this shape**: The raw menu flags do not cover every student restriction, and unknown dietary requirements will appear over time. Explicit reviewed fields keep the matching rules auditable while preserving the non-negotiable that safety-critical catering decisions are deterministic and reviewable.

---

## D-09 - Customisable dishes are split into orderable variants (E-24)

**Decision**: A source menu `dish` is the parent item from the caterer menu; an orderable choice is a `dish_variant`.

Every ingested dish receives one default `Standard` variant that inherits the source and keyword-inferred flags. Customisable items such as `Cali Burrito` must be split by the operator into concrete variants such as `Vegetarian`, `Chicken`, `Beef`, or any other caterer-confirmed option. Menu offers, allocation, and order lines operate on `dish_variants`, while retaining the parent `dish_id` for traceability to the raw menu item.

The Streamlit MVP currently supports creating variants and reviewing their GF/DF/NF/VO/halal and ingredient-exclusion flags; the equivalent workflow will be ported into the Next.js operator UI in `web/` under D-14. A generic customisable parent item should not be marked as safe for restricted students unless the specific orderable variant is safe.

**Why this shape**: A single boolean set on `dishes` cannot correctly represent a meal that may contain beef, chicken, or no meat depending on how it is ordered. Variants let the operator describe the exact option being offered without LLM guessing, and the generated caterer order can name the concrete option rather than a vague parent dish.

---

## D-10 - Approval and override audit model

**Decision**: Order-run approval and manual overrides are explicit audited operator actions.

Approving an order run changes `order_runs.status` from `generated` to `approved` and stores approval metadata (`approved_at`, `approved_by`, `approval_note`) for convenient display. The durable trace is an append-only `audit_log` row containing actor, action, entity, reason, timestamp, and before/after state snapshots.

Manual overrides are recorded in `manual_overrides` before any future override-application logic is added. Recording an override also writes an `audit_log` row. Override records require actor, reason, type, entity, and timestamp.

**Why this shape**: Approval and overrides are operational decisions, not generated facts. They must preserve who made the decision, when, and why before the system can safely support live communications or manual corrections.

---

## D-11 - Synthetic caterer contact anomalies (E-09)

**Decision**: Treat suspicious, pseudonymous, and free-webmail caterer contacts as expected artefacts of the competition/synthetic dataset.

The system should still surface recipient names and addresses verbatim in the order review UI and should snapshot the exact recipients used for each exported or sent communication. For this submission, these contact anomalies should not drive a dedicated verification workflow before communications persistence is implemented.

**Why this shape**: The suspicious addresses are not real production contact data. The useful system behaviour for the submission is auditable communications state, not overfitting to fake-address patterns.

---

## D-12 - Delivery location granularity (E-16)

**Decision**: Building/block is the delivery-location granularity for current school sessions.

Room numbers are expected to be missing most of the time. Delivery notes and caterer emails should use the source `Building` value as the destination and include the manager's mobile so the driver can resolve exact handoff details if needed. Missing room numbers should not be reported as a validation warning for this dataset.

**Why this shape**: The source data intentionally identifies the useful school block/building, and warning on absent room numbers creates noise without improving order correctness.

---

## D-13 - Communication export is not email delivery

**Decision**: `exported` means an operator produced and recorded a send-ready communication snapshot from an approved, issue-free order run. It does not mean the email was sent or delivered.

The first export for each `(order_run_id, caterer_id)` stores the immutable communication snapshot: exact recipients, subject, body, rendered text, delivery notes, template version, actor, reason, and timestamp. Repeated exports reuse that same snapshot and append export events. A human operator may then copy or download the recorded text and send it manually outside the system.

The Next.js UI must not render caterer communication templates itself. It may display persisted communication snapshots and may call an explicit audited export-recording contract. If a communication snapshot does not exist yet, the UI should show that a Python-owned communication preparation/export action is required rather than assembling the draft in TypeScript.

Future live email sending should add a separate `sent` state or delivery event with provider metadata. It should not overload `exported`.

**Why this shape**: The system needs a durable audit trail for what was prepared before it can safely send email. Separating "exported" from "sent" avoids claiming delivery that the current application cannot prove.

---

## D-14 - Operator UI is Next.js + Supabase, not Streamlit

**Decision**: The final operator interface is a Next.js 16 (App Router) + TypeScript app in `web/`, backed by Supabase Auth and the existing PostgreSQL schema. The Streamlit MVPs (`app/menu_setup_mvp.py`, `app/order_review_mvp.py`) become legacy verification harnesses and will be removed once `web/` reaches parity.

**Stack**:

- Next.js 16 App Router, TypeScript, React Server Components, Server Actions
- shadcn/ui (Radix primitives) + Tailwind CSS
- `@supabase/ssr` server client and `@supabase/supabase-js` browser client
- Supabase Auth (cookie session, SSR)
- TanStack Query for client-side caching where required; TanStack Table for data grids
- React Hook Form + Zod for forms and server-action input validation
- Sonner for toasts; Lucide for icons; Geist or Inter typography

Supabase SSR helpers should be isolated behind `web/lib/supabase/*` and package versions should be pinned, because the auth helper surface can change.

**Why not Streamlit**:

- Streamlit's reactive model and rendering ceiling produce a "data tool" feel; the submission target is a polished operator product.
- Composing dense workflows (variant editor, dietary review, allocation grid, export drawer, audit trail) inside Streamlit forces awkward state passing and a flat layout.
- shadcn/ui + Tailwind give pixel-level control without bespoke design work, and Supabase's TypeScript SDK exposes RLS, real-time, and auth more cleanly than the Python client.
- Auth, RLS-aware reads, and cookie-based SSR are first-class in `@supabase/ssr`; replicating them in Streamlit is friction.

**Boundary with Python**:

- Python in `src/padea_catering/` remains the authority on ingestion, deterministic ordering, validation, order generation, and Python-owned audited operations.
- Batch operations stay CLI-driven by default: ingestion, order generation, and validation preflight.
- Simple operator-triggered writes from Next.js, such as approve/reopen/export metadata, may go through Server Actions that call explicit audited database contracts.
- The Next.js layer must not re-implement allocation, dietary safety, quantity logic, ingestion parsing, or validation rules.
- If the UI needs to trigger Python jobs live, add a small HTTP/queue bridge such as FastAPI or a job runner endpoint. Do not import or shell into Python from the Next.js request path as the normal architecture.

**Migration plan**:

1. Scaffold `web/` (Next.js, Tailwind, shadcn/ui, Supabase clients, generated types) with auth shell and mocked/static or server-only dev data.
2. Phase 4 RLS policies and `security_invoker` views land before real browser-facing Supabase reads.
3. Port menu setup, order review, approval, and export workflows from the Streamlit MVPs into `web/`.
4. Once parity is verified end-to-end on the existing approved run, the Streamlit MVPs in `app/` are removed.

**Why this shape**: the competition target is a finished, taste-forward catering product. Next.js + Supabase is the natural pairing for that level of polish without abandoning the deterministic Python core, the audit model, or the existing migrations.

---

## D-15 - Operator identity and Supabase Auth model

**Decision**: For the submission, the operator UI uses Supabase Auth with a single operator class. There is no custom Postgres role and no JWT role claim in this phase.

Authenticated users are treated as operators only if they have a row in a new `public.operators` profile table keyed to `auth.users.id`. The table stores the durable audit display name used by the UI and audited write contracts:

- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text not null`
- `created_at timestamptz not null default now()`

The app should use email/password auth for the submission environment, with a seeded demo operator account documented outside source control. RLS policies and write contracts should use the authenticated user id plus the `operators` row for operator membership and display-name lookup.

Do not use `raw_user_meta_data` or other user-editable metadata for authorization or audit names. If multiple roles are needed later, add an explicit role model through `operators` or a related role table rather than changing UI assumptions ad hoc.

**Why this shape**: The UI needs reliable actor identity for audit rows, but a full multi-role authorization model would add unnecessary complexity for the submission. A profile table keeps audit names database-owned while avoiding unsafe JWT/user-metadata authorization.

---

## D-16 - Active week derivation for the operator UI

**Decision**: For the current submission dataset, the active week is derived from source `sessions` data rather than stored in a separate configuration table.

The Phase 4 read model should expose an active-week value based on the earliest available session date in the operational dataset, grouped into a service-week range. The current fixture data has one service week, `2026-05-01` through `2026-05-04`, so this avoids adding configuration state before it is needed.

The UI week switcher should read from the same browser-safe week view used by Dashboard and Weeks. It should not infer the active week independently in React.

If future production data contains multiple active or upcoming weeks, add an explicit `service_weeks` or operator-configured active-week table and record that as a new decision.

**Why this shape**: Nearly every operator screen needs a week anchor, but this dataset has only one week. A deterministic read model is enough for the submission and avoids premature configuration tables.

---

## D-17 - Website write contracts and audit coverage

**Decision**: Browser-triggered domain writes must go through explicit audited database/backend contracts. Next.js Server Actions may validate form shape and call those contracts, but they must not implement multi-step catering business rules directly against raw tables.

For Phase 4 and later, prefer Postgres RPC functions for website writes that need transactional validation and audit rows, including:

- menu offer updates
- dish variant creation
- dish variant dietary/ingredient review
- dish variant availability changes
- order run approval
- order run reopen
- manual override intent recording
- communication export event recording

The existing Python audited actions can remain as verification harnesses and backend operations, but the website should not duplicate their internal rules in TypeScript. If a Python-owned operation has no RPC or HTTP/queue bridge yet, the UI should show the operation as unavailable or CLI-backed rather than recreating it.

The Phase 4 schema work should extend `audit_log.action` so menu setup writes can be recorded centrally. Required action tokens include at least:

- `dish_variant_created`
- `dish_variant_reviewed`
- `dish_variant_availability_updated`
- `menu_offers_updated`

For the existing stored token `order_run_unapproved`, the operator UI should display the event as "Reopen run" unless a later migration renames the action token.

Menu-offer updates should normally be logged as one audit row per caterer-week save with before/after JSON arrays of selected `dish_variant_id` values. That is easier to read than one audit row per checkbox toggle and still preserves reproducibility.

**Why this shape**: The website needs audited writes without moving safety-critical logic into TypeScript. RPC/write contracts keep validation, mutation, and audit insertion transactionally close to the data source.
