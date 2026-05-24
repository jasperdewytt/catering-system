# Website Data Contracts

**Status**: Phase 4 first read-model slice implemented for Dashboard and Weeks  
**Last updated**: 2026-05-24  
**Related docs**:

- [Operator Website Plan](WEBSITE_PLAN.md)
- [Website Implementation Stages](WEBSITE_IMPLEMENTATION_STAGES.md)
- [D-15 - Operator identity and Supabase Auth model](DECISIONS.md#d-15---operator-identity-and-supabase-auth-model)
- [D-16 - Active week derivation for the operator UI](DECISIONS.md#d-16---active-week-derivation-for-the-operator-ui)
- [D-17 - Website write contracts and audit coverage](DECISIONS.md#d-17---website-write-contracts-and-audit-coverage)

## Purpose

This file is the screen-to-data and write-contract map for the Next.js operator UI. It exists so implementation can start without guessing which data source or backend owner each screen depends on.

Keep this file current whenever a browser-facing view, RPC, Server Action, or route changes.

## Baseline Assumptions

- `web/` exists as a Next.js 16 App Router scaffold with Supabase Auth plumbing, protected shell routes, and first authenticated operational reads for Dashboard and Weeks.
- Existing operational tables have RLS enabled. `anon` remains denied. Authenticated reads are available only to users with a matching `public.operators` row.
- Phase 4 added browser-safe `security_invoker` views for the first read-only UI slice.
- `public.operators` maps Supabase Auth users to durable operator display names.
- Current active week is derived from `sessions` data per D-16.
- Order generation remains CLI-triggered until the Stage 9 job bridge.
- Validation summaries for the first web build are read-only summaries over stored facts; full persisted Python validation findings are a later enhancement unless live operations require them sooner.

## Screen To Data Map

| Screen                                   | Initial reads                                                                                                                             | Writes                                                       | Stage status                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------- |
| `/login`                                 | Supabase Auth session; `operators` profile for shell display                                                                              | sign in, sign out                                            | Stage 3 scaffolded              |
| `/dashboard`                             | `operator_current_week`, `operator_week_status`, `operator_week_sessions`, `operator_order_runs`, `operator_audit_events`                 | none                                                         | Stage 5 first slice implemented |
| `/weeks`                                 | `operator_weeks`                                                                                                                          | none                                                         | Stage 5 first slice implemented |
| `/weeks/[weekStart]`                     | `operator_week_status`, `operator_week_sessions`, `operator_order_runs`, `operator_audit_events`                                          | none                                                         | Stage 5 first slice implemented |
| `/weeks/[weekStart]/menu`                | `operator_menu_setup`, `operator_validation_summary`                                                                                      | menu offers, variant create/review/availability through RPCs | Stage 6 writes                  |
| `/weeks/[weekStart]/validation`          | `operator_validation_summary`, `operator_order_run_issues`; future `session_validation_findings`                                          | rerun validation only after job bridge                       | Stage 5 read, Stage 9 trigger   |
| `/weeks/[weekStart]/orders`              | `operator_order_runs`                                                                                                                     | generate run only after job bridge                           | Stage 5 read, Stage 9 trigger   |
| `/weeks/[weekStart]/orders/[orderRunId]` | `operator_order_runs`, `operator_order_run_lines`, `operator_order_run_allocations`, `operator_order_run_issues`, `operator_audit_events` | approve, reopen, manual override intent through RPCs         | Stage 7 writes                  |
| `/weeks/[weekStart]/exports`             | `operator_communications`, `operator_order_run_contacts`, `operator_audit_events`                                                         | record prepared caterer email through RPC/backend contract   | Stage 8 writes                  |
| `/caterers`                              | `operator_caterers`                                                                                                                       | none for submission                                          | Stage 5                         |
| `/caterers/[catererId]`                  | `operator_caterer_detail`, `operator_menu_setup`, `operator_communications`                                                               | none for submission                                          | Stage 5                         |
| `/students`                              | `operator_students`                                                                                                                       | none for submission                                          | Stage 5                         |
| `/students/[studentId]`                  | `operator_student_detail`, allocation and audit slices                                                                                    | none for submission                                          | Stage 5                         |
| `/audit`                                 | `operator_audit_events`                                                                                                                   | none                                                         | Stage 5                         |
| `/settings`                              | session user, `operators`, build metadata                                                                                                 | none for submission                                          | Stage 3/5                       |

## Implemented Phase 4 Read Models

The first group below is implemented in `supabase/migrations/20260524130454_phase_4_operator_read_models.sql`. These views use `WITH (security_invoker = true)` and are granted only to `authenticated`; underlying table access is guarded by RLS policies requiring a row in `public.operators`.

`web/types/supabase.ts` was updated for the implemented Phase 4 table and views. Local CLI typegen by project id is blocked without `SUPABASE_ACCESS_TOKEN`, and direct DB typegen hit IPv6/pooler connectivity from this environment, so the file currently contains the verified Phase 4 surface needed by the website slice rather than a full database type dump.

### `operator_current_week`

- `week_start date`
- `week_end date`
- `session_count integer`
- `latest_order_run_id uuid null`
- `latest_order_run_status text null`

Derive from `sessions` for the current dataset. Do not create a configurable active-week table yet.

### `operator_weeks`

- `week_start date`
- `week_end date`
- `session_count integer`
- `student_count integer`
- `caterer_count integer`
- `latest_order_run_id uuid null`
- `latest_order_run_status text null`
- `approved_at timestamptz null`
- `exported_caterer_count integer`
- `allocation_issue_count integer`

### `operator_week_status`

- `week_start date`
- `source_data_ready boolean`
- `menu_offers_ready boolean`
- `variant_review_ready boolean`
- `validation_state text`
- `latest_order_run_id uuid null`
- `latest_order_run_status text null`
- `approval_state text`
- `export_state text`
- `blocking_issue_count integer`
- `warning_count integer`
- `unreviewed_variant_count integer`
- `missing_offer_caterer_count integer`

The view may summarize stored facts. It must not reimplement Python validation rules.

### `operator_week_sessions`

- `session_id uuid`
- `week_start date`
- `session_date date`
- `school_id uuid`
- `school_name text`
- `caterer_id uuid`
- `caterer_name text`
- `manager_name text`
- `manager_mobile text`
- `building text`
- `enrolled_count integer`
- `orderable_student_count integer`
- `cancelled_count integer`
- `latest_order_line_count integer null`
- `export_state text null`

`orderable_student_count` and `cancelled_count` are derived from the latest persisted `order_allocations` statuses when a run exists. They are not a TypeScript or SQL reimplementation of absence, exclusion, dietary, or allocation logic.

## Deferred Read Models

The following contracts remain planned and should be added only when the corresponding page slice or audited write contract is ready.

### `operator_menu_setup`

- `week_start date`
- `caterer_id uuid`
- `caterer_name text`
- `dish_id uuid`
- `dish_name text`
- `variant_id uuid`
- `variant_name text`
- `is_available boolean`
- `is_offered boolean`
- `operator_reviewed boolean`
- `tags_reviewed_at timestamptz null`
- `tags_reviewed_by text null`
- dietary and ingredient flags already stored on `dish_variants`
- `minimum_order_quantity integer null`

### `operator_validation_summary`

- `week_start date`
- `severity text`
- `category text`
- `finding_count integer`
- `summary text`
- `target_route text null`

Allowed sources for the first web build:

- missing `menu_offers` by active caterer
- offered `dish_variants.operator_reviewed = false`
- latest `order_runs.status`
- latest `order_allocation_issues`
- missing communication snapshots or email preparation events for approved runs

Do not recompute caterer minimums, dietary safety, absence/exclusion handling, allocation decisions, or order quantities in this view.

### `operator_order_runs`

- `order_run_id uuid`
- `week_start date`
- `status text`
- `generated_at timestamptz`
- `generated_by text null`
- `approved_at timestamptz null`
- `approved_by text null`
- `approval_note text null`
- `allocation_count integer`
- `line_count integer`
- `issue_count integer`
- `exported_caterer_count integer`
- `is_latest boolean`

### `operator_order_run_lines`

- `order_run_id uuid`
- `order_line_id uuid`
- `caterer_id uuid`
- `caterer_name text`
- `session_id uuid`
- `school_name text`
- `session_date date`
- `dish_variant_id uuid`
- `display_name text`
- `quantity integer`
- `unit_price numeric null`
- `line_total numeric null`

### `operator_order_run_allocations`

- `order_run_id uuid`
- `allocation_id uuid`
- `student_id uuid`
- `student_name text`
- `school_name text`
- `year_level integer null`
- `session_id uuid`
- `session_date date`
- `dish_variant_id uuid null`
- `display_name text null`
- `dietary_tags text[]`
- `allocation_status text`
- `issue_count integer`

### `operator_order_run_issues`

- `issue_id uuid`
- `order_run_id uuid`
- `severity text`
- `category text`
- `message text`
- `student_id uuid null`
- `session_id uuid null`
- `dish_variant_id uuid null`

### `operator_order_run_contacts`

- `order_run_id uuid`
- `caterer_id uuid`
- `caterer_name text`
- `contact_id uuid`
- `contact_name text`
- `contact_role text`
- `email text`
- `recipient_kind text`
- `delivery_notes text`

### `operator_communications`

- `communication_id uuid`
- `order_run_id uuid`
- `caterer_id uuid`
- `caterer_name text`
- `subject text`
- `body text`
- `rendered_text text`
- `template_version text`
- `exported_at timestamptz null`
- `exported_by text null`
- `recipient_snapshot jsonb`
- `event_count integer`
- `latest_event_at timestamptz null`

This view displays persisted snapshots only. The UI must not build communication text.

### `operator_audit_events`

- `audit_id uuid`
- `created_at timestamptz`
- `actor_name text`
- `action text`
- `display_action text`
- `entity_type text`
- `entity_id uuid`
- `order_run_id uuid null`
- `reason text null`
- `before_state jsonb null`
- `after_state jsonb null`

Map stored `order_run_unapproved` to display action `Reopen run`.

### `operator_caterers` and `operator_caterer_detail`

Expose caterer name, assigned schools, contacts, weekly minimums, latest menu review status, latest order-line counts, and caterer-email readiness. No contact-verification workflow is required for the submission.

### `operator_students` and `operator_student_detail`

Expose student identity, school, year level, opted-out state, dietary tags, enrolments, absences, allocations, and relevant audit/override records. No student edit workflow is required for the submission.

## Write Contracts

All website writes are called from Server Actions. The Server Action validates request shape with Zod, resolves the signed-in operator, calls an audited backend/database contract, and revalidates affected routes.

| Operation                     | Contract owner                                             | Required audit                                             | Status before build         |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- | --------------------------- |
| Create dish variant           | Postgres RPC or existing backend action adapted for web    | `dish_variant_created`                                     | Needs Phase 4/6 contract    |
| Review dish variant flags     | Postgres RPC or existing backend action adapted for web    | `dish_variant_reviewed`                                    | Needs Phase 4/6 contract    |
| Change variant availability   | Postgres RPC or existing backend action adapted for web    | `dish_variant_availability_updated`                        | Needs Phase 4/6 contract    |
| Save menu offers              | Postgres RPC                                               | `menu_offers_updated` with before/after variant id arrays  | Needs Phase 4/6 contract    |
| Approve order run             | Postgres RPC or existing audited operation adapted for web | `order_run_approved`                                       | Needs web-callable contract |
| Reopen order run              | Postgres RPC or existing audited operation adapted for web | stored `order_run_unapproved`, displayed as "Reopen run"   | Needs web-callable contract |
| Record manual override intent | Postgres RPC or existing audited operation adapted for web | `manual_override_created`                                  | Needs web-callable contract |
| Record prepared caterer email | Postgres RPC/backend contract                              | `communication_exported`                                   | Needs web-callable contract |
| Trigger order generation      | Python job bridge                                          | job audit/status row                                       | Deferred to Stage 9         |
| Trigger validation preflight  | Python job bridge                                          | job audit/status row; future `session_validation_findings` | Deferred to Stage 9         |

## Deferred Data Contracts

### `session_validation_findings`

A persisted findings table is useful before live operations because it lets the UI display the full Python validation output without running the CLI during a request. It is not required before Stage 1 and is not required for the first read-only submission slice if `operator_validation_summary` is explicit about being a readiness summary.

When added, it should be written by `src/padea_catering.validation`, not by the Next.js app.

### Communication draft pre-generation

The current backend creates immutable communication snapshots when the preparation event is recorded. For the web UI, a stronger flow is preferred before Stage 8: generate or prepare draft snapshots through Python/backend code before the operator marks the caterer email ready, so the UI can preview persisted text without rendering templates in TypeScript.

The UI should handle both cases:

- snapshot exists: display it
- snapshot missing: show a clear state that a backend email preparation contract is required

### Manual override application

The website can record override intent, but it must not mutate generated allocations or order lines until override application logic is designed and implemented.

The UI may expose the existing override intent types: `allocation`, `order_line`, `student_attendance`, `dietary_resolution`, `contact`, and `other`.
