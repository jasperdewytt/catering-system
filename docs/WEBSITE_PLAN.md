# Operator Website Plan

**Status**: Implemented website reference for the Next.js operator console
**Last updated**: 2026-05-28
**Related decisions**:

- [D-14 - Operator UI is Next.js + Supabase, not Streamlit](DECISIONS.md#d-14---operator-ui-is-nextjs--supabase-not-streamlit)
- [D-15 - Operator identity and Supabase Auth model](DECISIONS.md#d-15---operator-identity-and-supabase-auth-model)
- [D-16 - Active week derivation for the operator UI](DECISIONS.md#d-16---active-week-derivation-for-the-operator-ui)
- [D-17 - Website write contracts and audit coverage](DECISIONS.md#d-17---website-write-contracts-and-audit-coverage)

## Purpose

The website is the final operator surface for Padea catering operations. It lets a coordinator move from source data readiness through weekly menu setup, order generation, order review, approval, caterer email preparation, safety-gated sending, and audit review without needing to inspect raw database tables or run historical tools.

The UI must present the system as an operations product, not a marketing site and not a generic admin panel. It should make the weekly catering run easy to scan, hard to misuse, and explicit about unresolved safety or data issues.

## Product Principles

- **Operational first**: the first screen should show the next task and a short task list for the current catering week.
- **Audit visible by default**: approvals, caterer email preparation, overrides, and actor/reason metadata should be surfaced near the action they explain.
- **Deterministic core respected**: the UI may trigger or display Python-owned outcomes, but must not duplicate allocation, dietary, validation, ingestion, or ordering rules.
- **No silent fixes**: ambiguous data appears as findings or review states, not hidden UI smoothing.
- **Dense but calm**: tables, status summaries, filters, and detail drawers should support repeat operator work without decorative clutter.
- **Safety language is concrete**: labels should say what is blocked, unreviewed, approved, email-ready, or safe for restricted students.
- **Human-readable audit targeting**: when an operator records a follow-up or override note, the UI should show names, schools, dates, dishes, and contacts; row UUIDs are submitted internally, not pasted by operators.

## Primary Users

- **Operations coordinator**: prepares weekly menu offers, reviews generated orders, approves runs, prepares caterer emails, and records override reasons.
- **Reviewer/manager**: checks order readiness, caterer email readiness, audit trail, and exceptions before the submission is considered complete.

Future roles can be added later, but the current console uses one operator class backed by Supabase Auth, RLS, and the `public.operators` profile table from D-15.

## Information Architecture

The app should use a persistent shell with:

- left sidebar or compact top-level navigation for core work areas
- current service week selector
- global status indicator for validation/run readiness
- signed-in operator menu
- page-level actions grouped on the right side of headers

The sidebar's Week Workflow panel should be dynamic, not instructional. It reads the current route week when the operator is inside `/weeks/[weekStart]`, otherwise falls back to `operator_current_week`, and shows one primary next action from stored read-model state. It must not calculate catering rules or trigger jobs.

Recommended top-level routes:

```text
/login
/dashboard
/weeks
/weeks/[weekStart]
/weeks/[weekStart]/menu
/weeks/[weekStart]/validation
/weeks/[weekStart]/orders
/weeks/[weekStart]/orders/[orderRunId]
/weeks/[weekStart]/exports
/caterers
/caterers/[catererId]
/students
/students/[studentId]
/audit
```

The default authenticated route should be `/dashboard`, which points operators to the active week and its next required action.

## Page Plan

### Login

Purpose: authenticate operators through Supabase Auth.

Key content:

- email/password form for the submission environment
- simple unauthenticated layout
- clear error state for failed login

Notes:

- Do not allow anonymous reads.
- Keep auth code isolated behind `web/lib/supabase/*`.
- Use email/password auth for the submission environment with a seeded demo operator account.
- Resolve the audit display name from `public.operators.display_name`, not editable user metadata.

### Dashboard

Purpose: give the coordinator one current view of the weekly operation.

Key content:

- next task card with the highest-priority operator action
- "Tasks to complete" list for menu setup, decision review, approval, and caterer email preparation
- "Needs a decision" queue for blocking errors, unreviewed variants, missing offers, allocation issues, and caterer emails not yet ready
- upcoming sessions grouped by date/school/caterer
- latest audit activity

Primary actions:

- open active week
- continue menu setup
- review latest order run
- open caterer email workflow

Empty/loading states:

- no active week configured
- no order run generated yet
- RLS/view unavailable in dev

Data note:

- Active week comes from the database-owned week data described in D-16. The React app should not independently infer it.

### Weeks Index

Purpose: browse service weeks and historical run state.

Key content:

- table of service weeks with generated/approved/caterer-email status
- counts for sessions, students, caterers, menu offers, order lines, allocation issues
- filters for status and date range

Primary actions:

- open week
- compare previous runs for the same week if superseded runs exist

### Week Overview

Purpose: show the full operational state for one week.

Key content:

- week header with dates and latest run status
- readiness checklist:
  - source data ingested
  - menu offers selected
  - dish variants reviewed
  - validation passed
  - order run generated
  - order approved
  - caterer email snapshots recorded
- session summary table grouped by school/caterer/date
- caterer summary: offer count, forecast quantity, minimum status, order line count, email readiness
- recent audit events scoped to the week

Primary actions:

- set up menu
- view validation
- open latest order
- open caterer emails

### Menu Setup

Purpose: configure weekly caterer offers and review concrete orderable variants.

Key content:

- caterer tabs or segmented control
- dish/variant table with dietary flags, ingredient flags, review status, availability, and offered state
- selected weekly offers panel with count and minimum-order implications
- variant editor drawer for customisable dishes
- review form for GF/DF/NF/VO/halal and ingredient-exclusion flags

Primary actions:

- create variant
- mark variant unavailable
- review/update dietary and ingredient flags with reason
- select/deselect weekly menu offers
- save offers for the week
- run validation or open validation page

Safety requirements:

- unreviewed customisable variants must be visually distinct
- any review-changing write must capture actor, timestamp, and reason where the schema requires it
- the UI must not infer safety beyond stored reviewed fields

### Validation

Purpose: show preflight findings before order generation or approval.

Key content:

- severity summary: errors, warnings, info
- findings table grouped by category
- filters for severity, category, caterer, school, session
- detail drawer showing affected records and recommended operator action

Primary actions:

- re-run validation if a bridge exists; otherwise show latest available validation/readiness state
- jump to menu setup, student, caterer, or order detail for the affected record

Phase note:

- For the first web build, this page may use view-backed readiness summaries. Those summaries may count stored facts such as menu-offer presence, unreviewed offered variants, order run status, and `order_allocation_issues`.
- Do not recompute caterer minimums, dietary safety, absence/exclusion handling, or allocation rules in SQL or TypeScript.
- A future `session_validation_findings` table can persist Python validation output for a fuller findings table. That is not required before Stage 1, but it is required before the UI claims to show full validation preflight history.

### Orders Index

Purpose: browse order runs for a week.

Key content:

- table of runs with status, generated timestamp, generation metadata, allocation count, issue count, approved/caterer-email state
- clear superseded vs active run state

Primary actions:

- open run
- generate run only after a deliberate Python job bridge exists

Empty/loading states:

- no run yet: show the CLI command needed for the current submission, `uv run python -m padea_catering.ordering --week-start 2026-06-01`, rather than exposing a fake Generate button.

### Order Run Detail

Purpose: review persisted order runs, allocations, contacts, issues, and audited operator decisions.

Key content:

- run header: status, generated/approved metadata, issue count, latest email readiness
- order lines table grouped by caterer/session/variant
- allocation table with student, school, session, variant, dietary tags, absence/exclusion context
- allocation issue panel
- contacts and delivery notes by caterer
- approval and reopen history
- manual override history
- audit timeline scoped to the run

Primary actions:

- approve generated, issue-free run with note/reason
- reopen approved run with reason
- record manual override intent with reason
- open caterer email workflow

Safety requirements:

- approval must be disabled for blocked/issue-bearing runs
- approval/reopen actions must use audited backend contracts
- manual overrides should not imply allocation mutation until override application logic exists
- manual override intent may use the existing override types: `allocation`, `order_line`, `student_attendance`, `dietary_resolution`, `contact`, `other`

### Caterer Emails

Purpose: review persisted caterer email snapshots, create missing snapshots through the Python bridge, and use the safety-gated send path.

Key content:

- caterer list for the selected approved run
- recipient snapshots: to/cc/name/contact role
- deterministic subject/body/rendered text preview
- persisted communication snapshot state
- email preparation events timeline
- delivery notes

Primary actions:

- record prepared email for a caterer
- send one reviewed caterer email or all ready emails through the backend bridge
- view previous email preparation events

Safety requirements:

- label the visible workflow as "Caterer emails", with states such as "Email ready" and "Not emailed yet"
- display persisted communication snapshots and recipient snapshots; do not render caterer email templates in TypeScript
- first email-preparation recording creates or displays the immutable communication snapshot through a Python/backend contract; the persisted-first web slice displays existing snapshots and records repeated preparation events
- repeated email-preparation recordings append events without mutating the original snapshot
- live email sending uses the Python backend bridge, records `sent`/`failed` delivery state and provider metadata, and is test-routed through `PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE` on the current safety-gated send path

### Caterers

Purpose: manage and inspect caterer readiness.

Key content:

- caterer table with contacts, assigned schools, weekly minimums, menu item counts, latest review/email readiness
- detail page with contacts, menus, variants, minimums, historical order lines, and communications

Primary actions:

- open caterer detail
- jump to menu setup filtered to caterer

Phase note:

- Contact anomalies are expected in this dataset; surface contacts verbatim and rely on communication snapshots rather than building a dedicated verification workflow now.

### Students

Purpose: inspect student records and dietary/order allocation context.

Key content:

- searchable student table with school, year level, opted-out state, dietary tags, enrolments
- student detail showing source facts, session enrolments, absences, allocations, and relevant audit/override records

Primary actions:

- inspect student context from validation or order allocation pages

Phase note:

- Manual edits to students should stay out of scope until explicit audited contracts exist.

### Audit

Purpose: make the operational record inspectable.

Key content:

- append-only audit table with action, actor, timestamp, entity, reason, before/after availability
- filters for week, order run, action, actor, entity type
- detail drawer for before/after JSON snapshots

Primary actions:

- inspect audit event
- jump to related order run, communication, or override

Display note:

- The stored `order_run_unapproved` action is displayed as "Reopen run" in operator-facing copy.

### Settings

Purpose: house low-frequency operator/admin configuration.

Initial content:

- signed-in operator profile
- environment/project label
- app version/build metadata
- links to docs or operational runbooks if needed

For this submission, Settings is hidden from the main navigation and remains a deferred internal route only. Do not put core workflows or write functionality in Settings.

## Route Build Order

1. **Stage 0 readiness inventory**: finish the screen-to-data and write-contract map in `docs/WEBSITE_DATA_CONTRACTS.md`.
2. **Auth shell and dashboard**: login, authenticated layout, active week display, and read-backed readiness cards.
3. **Read-only week overview**: Supabase SSR read path through secure operator views; no writes.
4. **Menu setup parity**: variant review and weekly offer selection through Server Actions and audited contracts where required.
5. **Order review parity**: run list, order run detail, allocation/order-line tables, approval/reopen actions. Implemented for order review and approval.
6. **Caterer email workflow**: persisted snapshot review, recipients, rendered text, delivery notes, repeat preparation-event recording, missing snapshot creation through the Python bridge, and safety-gated sending. Implemented.
7. **Validation read page**: implemented from readiness summaries and persisted latest order-run issues; full validation history waits for `session_validation_findings`.
8. **Audit and drilldowns**: audit, caterer detail, and student detail pages implemented; richer cross-links remain.
9. **Caterer and student inspection**: caterer and student inspection implemented.
10. **Historical harness retirement**: parity is confirmed and the Next.js app is now the primary operator surface; physical file removal is a separate cleanup task.

## Data Access Shape

Browser-facing reads should prefer Phase 4 `security_invoker` views that are shaped for UI screens. The app should avoid large table joins in React components and avoid exposing service-role credentials to `web/`.

The initial screen-to-data map, write status, and view sketches live in [Website Data Contracts](WEBSITE_DATA_CONTRACTS.md). Keep that file updated before changing a screen's data source or adding a write.

Recommended view/API groups:

- `operator_current_week`
- `operator_weeks`
- `operator_week_status`
- `operator_week_sessions`
- `operator_menu_setup`
- `operator_validation_summary`
- `operator_order_runs`
- `operator_order_run_lines`
- `operator_order_run_allocations`
- `operator_order_run_issues`
- `operator_order_run_contacts`
- `operator_communications`
- `operator_communication_recipients`
- `operator_communication_events`
- `operator_audit_events`
- `operator_caterers`
- `operator_caterer_detail`
- `operator_students`
- `operator_student_detail`

Writes should go through Server Actions with Zod validation that call audited database/backend contracts, preferably Postgres RPCs for browser-triggered domain writes:

- save menu offers
- create/update dish variant review
- update dish variant availability
- approve order run
- reopen order run
- record follow-up/override notes
- create missing caterer email snapshots through the narrow Python backend bridge
- record repeat prepared-caterer-email events for existing immutable snapshots
- create order runs through the narrow Python backend bridge
- future audited individual meal edits through a backend-owned contract

Individual meal editing is intentionally separate from follow-up notes. A future meal-edit workflow must call a backend/RPC contract that validates eligible variants, applies allocation and order-line changes transactionally, and records before/after audit state; the Next.js UI must not directly recalculate or mutate generated order facts.

Python-owned jobs should remain outside the request path unless a deliberate job bridge is added. Order generation now has a narrow synchronous bridge, while broader jobs remain deferred:

- ingestion
- validation preflight
- order generation through `POST /internal/order-runs` implemented
- caterer email snapshot creation and safety-gated sending through backend bridges implemented

Server Actions may shape form data, enforce user-interface validation, call `supabase.rpc(...)`, trigger route revalidation, and map database errors into user-facing messages. They must not independently decide safety, allocation, order quantities, caterer minimum compliance, or communication template contents.

## Component Plan

Reusable app components:

- `AppShell`
- `WeekSwitcher`
- `StatusBadge`
- `ReadinessChecklist`
- `FindingSeverityBadge`
- `AuditTimeline`
- `ReasonDialog`
- `DataTable`
- `EmptyState`
- `PageHeader`
- `CatererTabs`
- `DietaryFlagGrid`
- `VariantReviewDrawer`
- `OrderRunStatusHeader`
- `CommunicationPreview`

Use shadcn/ui primitives for buttons, dialogs, drawers/sheets, tabs, forms, popovers, tables, badges, tooltips, and toasts. Use Lucide icons for actions and status hints where the icon improves scanning.

`ReasonDialog` is a shared pattern for approve, reopen, manual override intent, email preparation recording, and review-changing writes. It uses one required reason text field with a minimum of 10 trimmed characters. Dialog titles and secondary fields are action-specific, but reason validation is shared.

## Visual Direction

The UI should feel like a precise operations console:

- restrained neutral base with clear semantic color for success/warning/error/blocked/email-ready
- compact page headers and dense tables
- no marketing hero sections
- no decorative cards nested inside cards
- cards only for repeated summary widgets or framed tools
- clear page-level empty states rather than vague "no data" messages
- status text should be explicit: `Generated`, `Approved`, `Email ready`, `Blocked`, `Unreviewed`, `Superseded`

Initial navigation labels:

- Dashboard
- Weeks
- Menu
- Validation
- Orders
- Caterer Emails
- Caterers
- Students
- Audit

## Key Workflows

### Weekly Happy Path

1. Operator logs in.
2. Dashboard shows the active week.
3. Operator reviews menu variants and selects weekly offers.
4. Validation shows no blocking errors.
5. The operator confirms generation in the website. Next.js calls `POST /internal/order-runs`; Python produces a generated run and records the audit event.
6. Operator reviews order lines, allocations, contacts, and delivery notes.
7. Operator approves the run with a note.
8. Operator marks caterer emails ready for each caterer.
9. Audit page shows approval and email preparation events.

### Blocked Menu Path

1. Dashboard shows unreviewed variants or missing offers.
2. Operator opens Menu Setup.
3. Operator creates concrete variants for customisable dishes.
4. Operator reviews dietary and ingredient flags with a reason.
5. Operator saves offers.
6. Validation readiness updates.

### Blocked Order Path

1. Order run contains allocation issues or validation errors.
2. Approval controls are disabled.
3. Operator inspects issue detail and affected student/session.
4. Operator records manual override intent if appropriate.
5. Actual allocation mutation remains deferred until override application logic exists.

### Caterer Email Path

1. Operator opens Caterer Emails for an approved, issue-free run.
2. UI shows persisted rendered text, delivery notes, recipient snapshots, and event history.
3. Operator records a repeat preparation event with reason for an existing snapshot.
4. Event history and audit rows update without mutating the original snapshot.
5. Missing snapshot creation remains a Python/backend bridge concern.

### Order Generation Path

1. Operator opens Order Runs for a week.
2. Operator confirms generation and may add an audit note.
3. Server Action resolves the operator display name and calls `POST /internal/order-runs`.
4. Python runs `generate_order_run(...)`, persists the new run, supersedes prior `blocked`/`generated` runs, and inserts `order_run_generated`.
5. The page refreshes and links to the new run detail page.

## Initial Design Targets

The historical first design pass covered:

1. `/dashboard`
2. `/weeks/[weekStart]/menu`
3. `/weeks/[weekStart]/orders/[orderRunId]`
4. `/weeks/[weekStart]/exports`
5. `/audit`

These five screens cover the core product feel: readiness, setup, review, communication, and traceability.

## Remaining Planning Questions

- Before live operations, decide whether full Python validation output should be persisted to `session_validation_findings`, or whether submission readiness summaries plus generated-run issues are enough.
