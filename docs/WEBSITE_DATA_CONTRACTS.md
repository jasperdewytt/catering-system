# Website Data Contracts

**Status**: Phase 4 caterer read pages implemented
**Last updated**: 2026-05-25
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

| Screen                                   | Initial reads                                                                                                                                                                                         | Writes                                                            | Stage status                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `/login`                                 | Supabase Auth session; `operators` profile for shell display                                                                                                                                          | sign in, sign out                                                 | Stage 3 scaffolded                  |
| `/dashboard`                             | `operator_current_week`, `operator_week_status`, `operator_week_sessions`, `operator_order_runs`, `operator_audit_events`                                                                             | none                                                              | Stage 5 first slice implemented     |
| `/weeks`                                 | `operator_weeks`                                                                                                                                                                                      | none                                                              | Stage 5 first slice implemented     |
| `/weeks/[weekStart]`                     | `operator_week_status`, `operator_week_sessions`, `operator_order_runs`, `operator_audit_events`                                                                                                      | none                                                              | Stage 5 first slice implemented     |
| `/weeks/[weekStart]/menu`                | `operator_menu_setup`, `operator_validation_summary`                                                                                                                                                  | menu offers, variant create/review/availability through RPCs      | Stage 6 implemented                 |
| `/weeks/[weekStart]/validation`          | `operator_validation_summary`, `operator_order_run_issues`; future `session_validation_findings`                                                                                                      | rerun validation only after job bridge                            | Stage 5 read, Stage 9 trigger       |
| `/weeks/[weekStart]/orders`              | `operator_order_runs`                                                                                                                                                                                 | generate run only after job bridge                                | Stage 7 read implemented            |
| `/weeks/[weekStart]/orders/[orderRunId]` | `operator_order_runs`, `operator_order_run_lines`, `operator_order_run_allocations`, `operator_order_run_issues`, `operator_order_run_contacts`, `operator_manual_overrides`, `operator_audit_events` | approve, reopen, follow-up/override notes through RPCs            | Stage 7 implemented                 |
| `/weeks/[weekStart]/exports`             | `operator_communications`, `operator_communication_recipients`, `operator_communication_events`, `operator_audit_events`                                                                              | repeat email-preparation event through RPC for existing snapshots | Stage 8 persisted-first implemented |
| `/caterers`                              | `operator_caterers`                                                                                                                                                                                   | none for submission                                               | Stage 9 implemented                 |
| `/caterers/[catererId]`                  | `operator_caterer_detail`                                                                                                                                                                             | none for submission                                               | Stage 9 implemented                 |
| `/students`                              | `operator_students`                                                                                                                                                                                   | none for submission                                               | Stage 5                             |
| `/students/[studentId]`                  | `operator_student_detail`, allocation and audit slices                                                                                                                                                | none for submission                                               | Stage 5                             |
| `/audit`                                 | `operator_audit_events`                                                                                                                                                                               | none                                                              | Stage 5 implemented                 |
| `/settings`                              | session user, `operators`, build metadata                                                                                                                                                             | none for submission                                               | Stage 3/5                           |

## Implemented Phase 4 Read Models

The first Dashboard/Weeks group below is implemented in `supabase/migrations/20260524130454_phase_4_operator_read_models.sql`. The menu setup group is implemented in `supabase/migrations/20260524154500_menu_setup_read_models_and_rpcs.sql`. The order review group is implemented in `supabase/migrations/20260524171000_order_review_read_models_and_rpcs.sql`. The caterer-email persisted-first group is implemented in `supabase/migrations/20260525100000_caterer_email_read_models_and_rpc.sql`. The caterer directory/detail group is implemented in `supabase/migrations/20260525113000_caterer_read_models.sql`. These views use `WITH (security_invoker = true)` and are granted only to `authenticated`; underlying table access is guarded by RLS policies requiring a row in `public.operators`.

`web/types/supabase.ts` was updated for the implemented Phase 4 table, views, menu RPCs, and order-review RPCs. Local CLI typegen by project id is blocked without `SUPABASE_ACCESS_TOKEN`, so the file currently contains the verified website surface needed by the implemented slices rather than a full database type dump.

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

### `operator_menu_setup`

- `week_start date`
- `week_end date`
- `caterer_id uuid`
- `caterer_name text`
- `dish_id uuid`
- `dish_name text`
- `dish_name_raw text`
- `variant_id uuid`
- `variant_name text`
- `display_name text`
- `is_default boolean`
- `is_available boolean`
- `is_offered boolean`
- `menu_offer_id uuid null`
- `selected_by text null`
- `selected_at timestamptz null`
- `offer_notes text null`
- `is_gluten_free boolean`
- `is_dairy_free boolean`
- `is_nut_free boolean`
- `is_vegetarian_option boolean`
- `is_halal_inferred boolean`
- `has_no_declared_tags boolean`
- `contains_beef boolean`
- `contains_pork boolean`
- `contains_red_meat boolean`
- `contains_fish boolean`
- `contains_shellfish boolean`
- `ingredient_notes text null`
- `ingredient_flags_source text`
- `operator_reviewed boolean`
- `tags_reviewed_at timestamptz null`
- `tags_reviewed_by text null`
- `tags_review_reason text null`
- `valid_offer_counts smallint[]`
- `current_selected_count integer`
- `selected_minimum_meals integer null`

One row per visible `dish_variant` for an active caterer/week. The view exposes stored variant flags, offer selection metadata, and configured caterer menu-item count tiers. It does not allocate students, calculate quantities, resolve absences, or infer dietary safety.

### `operator_validation_summary`

- `week_start date`
- `severity text`
- `category text`
- `finding_count integer`
- `summary text`
- `target_route text null`
- `caterer_id uuid null`
- `caterer_name text null`

Implemented menu-readiness categories:

- `missing_caterer_offer_set`
- `invalid_offer_count`
- `offered_unavailable_variant`
- `offered_unreviewed_variant`
- `latest_order_status`
- `allocation_issue_summary`

Allowed sources are stored menu offers, stored variant review/availability fields, configured caterer menu-item count tiers, latest persisted order status, and latest persisted allocation issues. The view does not recompute caterer minimum compliance, dietary safety, absence/exclusion handling, allocation decisions, or order quantities.

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

### `operator_manual_overrides`

- `manual_override_id uuid`
- `order_run_id uuid`
- `actor_name text`
- `override_type text`
- `entity_type text`
- `entity_id uuid null`
- `reason text`
- `before_state jsonb`
- `after_state jsonb`
- `created_at timestamptz`

This view exposes follow-up/override note records only. The UI should let operators choose affected allocations, order lines, contacts, or the whole run with human-readable labels, then submit the selected row UUID internally. It does not apply manual corrections or mutate generated allocation/order facts.

### `operator_communications`

- `communication_id uuid`
- `order_run_id uuid`
- `week_start date`
- `order_run_status text`
- `issue_count integer`
- `caterer_id uuid`
- `caterer_name text`
- `email_state text`
- `subject text`
- `body text`
- `rendered_text text`
- `delivery_note_text text`
- `template_version text`
- `exported_at timestamptz null`
- `exported_by text null`
- `line_count integer`
- `total_quantity integer`
- `event_count integer`
- `latest_event_at timestamptz null`

One row per order-run/caterer represented in persisted order lines. Communication fields are nullable when a snapshot is missing. This view displays persisted snapshots only; it does not build communication text.

### `operator_communication_recipients`

- `recipient_id uuid`
- `communication_id uuid`
- `order_run_id uuid`
- `caterer_id uuid`
- `caterer_name text`
- `caterer_contact_id uuid null`
- `display_name text null`
- `email text`
- `recipient_type text`
- `role text null`
- `cc_preference text null`
- `created_at timestamptz`

This view exposes immutable recipient snapshots captured with the communication record, not live contact recomputation.

### `operator_communication_events`

- `event_id uuid`
- `communication_id uuid`
- `order_run_id uuid`
- `caterer_id uuid`
- `caterer_name text`
- `event_type text`
- `actor_name text`
- `reason text`
- `metadata jsonb`
- `created_at timestamptz`

This view exposes append-only email-preparation events.

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

### `operator_caterers`

- `caterer_id uuid`
- `caterer_name text`
- `region text null`
- `per_item_price numeric`
- `gst_inclusive boolean`
- `gst_rate_percent numeric`
- `delivery_fee numeric`
- `delivery_scope text`
- `delivery_notes text null`
- `assigned_school_names text[]`
- `assigned_school_count integer`
- `contact_count integer`
- `primary_contact_name text null`
- `primary_contact_email text null`
- `primary_contact_role text null`
- `valid_offer_counts integer[]`
- `weekly_minimum_tiers jsonb`
- `dish_count integer`
- `variant_count integer`
- `available_variant_count integer`
- `reviewed_variant_count integer`
- `unreviewed_variant_count integer`
- `latest_order_run_id uuid null`
- `latest_order_week_start date null`
- `latest_order_run_status text null`
- `latest_order_line_count integer`
- `latest_order_quantity integer`
- `latest_order_total numeric`
- `latest_communication_id uuid null`
- `email_state text`
- `exported_at timestamptz null`
- `exported_by text null`
- `communication_event_count integer`
- `latest_communication_event_at timestamptz null`

One row per caterer. Pricing, delivery, contact, school, menu-review, latest persisted order, and latest email-readiness fields are display summaries over stored facts. The view does not verify contacts, recalculate caterer minimum compliance, generate communication text, or recompute ordering/allocation rules.

### `operator_caterer_detail`

- `caterer_id uuid`
- `caterer_name text`
- `region text null`
- `per_item_price numeric`
- `gst_inclusive boolean`
- `gst_rate_percent numeric`
- `delivery_fee numeric`
- `delivery_scope text`
- `delivery_notes text null`
- `assigned_school_count integer`
- `contact_count integer`
- `dish_count integer`
- `variant_count integer`
- `available_variant_count integer`
- `reviewed_variant_count integer`
- `unreviewed_variant_count integer`
- `contacts jsonb`
- `weekly_minimums jsonb`
- `assigned_schools jsonb`
- `menu_summary jsonb`
- `latest_order_totals jsonb`
- `latest_order_lines jsonb`
- `latest_communication jsonb`

One row per caterer with JSON arrays for operator-friendly drilldown sections. Contacts are shown verbatim from source rows, including synthetic or unverified contact data. Latest order and communication sections expose persisted rows only; they do not build or mutate email snapshots.

## Deferred Read Models

The following contracts remain planned and should be added only when the corresponding page slice or audited write contract is ready.

### `operator_students` and `operator_student_detail`

Expose student identity, school, year level, opted-out state, dietary tags, enrolments, absences, allocations, and relevant audit/override records. No student edit workflow is required for the submission.

## Write Contracts

All website writes are called from Server Actions. The Server Action validates request shape with Zod, resolves the signed-in operator, calls an audited backend/database contract, and revalidates affected routes.

| Operation                      | Contract owner                                  | Required audit                                             | Status                             |
| ------------------------------ | ----------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| Create dish variant            | `operator_create_dish_variant` RPC              | `dish_variant_created`                                     | Implemented                        |
| Review dish variant flags      | `operator_review_dish_variant` RPC              | `dish_variant_reviewed`                                    | Implemented                        |
| Change variant availability    | `operator_update_dish_variant_availability` RPC | `dish_variant_availability_updated`                        | Implemented                        |
| Save menu offers               | `operator_save_menu_offers` RPC                 | `menu_offers_updated` with before/after variant id arrays  | Implemented                        |
| Approve order run              | `operator_approve_order_run` RPC                | `order_run_approved`                                       | Implemented                        |
| Reopen order run               | `operator_reopen_order_run` RPC                 | stored `order_run_unapproved`, displayed as "Reopen run"   | Implemented                        |
| Record follow-up/override note | `operator_record_manual_override` RPC           | `manual_override_created`                                  | Implemented                        |
| Record prepared caterer email  | `operator_record_caterer_email_preparation` RPC | `communication_exported`                                   | Implemented for existing snapshots |
| Trigger order generation       | Python job bridge                               | job audit/status row                                       | Deferred to Stage 9                |
| Trigger validation preflight   | Python job bridge                               | job audit/status row; future `session_validation_findings` | Deferred to Stage 9                |

## Deferred Data Contracts

### `session_validation_findings`

A persisted findings table is useful before live operations because it lets the UI display the full Python validation output without running the CLI during a request. It is not required before Stage 1 and is not required for the first read-only submission slice if `operator_validation_summary` is explicit about being a readiness summary.

When added, it should be written by `src/padea_catering.validation`, not by the Next.js app.

### Communication draft pre-generation / missing snapshot creation

The current web UI can preview persisted communication snapshots and record repeat preparation events for existing snapshots. Creating a missing immutable snapshot from the web remains deferred because the deterministic communication template builder is Python-owned.

The UI should handle both cases:

- snapshot exists: display it
- snapshot missing: show a clear state that a Python/backend email preparation contract is required

### Manual override application

The website can record follow-up/override notes, but it must not mutate generated allocations or order lines until override application logic is designed and implemented.

The UI may expose the existing override intent types: `allocation`, `order_line`, `student_attendance`, `dietary_resolution`, `contact`, and `other`.

Future individual meal editing must be a separate audited backend contract. It should validate eligible replacement variants, update the affected allocation and order-line totals transactionally, preserve before/after state, and make clear that the run has diverged from the deterministic generator output.
