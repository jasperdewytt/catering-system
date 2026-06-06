# Website Data Contracts

**Status**: Implemented operator data and write contract reference
**Last updated**: 2026-06-06
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

- `web/` is the primary Next.js 16 App Router operator console with Supabase Auth plumbing, protected shell routes, and authenticated operational reads across the implemented workflow.
- Existing operational tables have RLS enabled. `anon` remains denied. Authenticated reads are available only to users with a matching `public.operators` row.
- Browser-safe `security_invoker` views expose operator-shaped data for implemented routes.
- `public.operators` maps Supabase Auth users to durable operator display names.
- Current active week is derived from `sessions` data per D-16.
- Order generation is available from the website through the narrow Python backend bridge.
- Validation summaries for the first web build are read-only summaries over stored facts; full persisted Python validation findings are a later enhancement unless live operations require them sooner.

## Screen To Data Map

| Screen                                   | Initial reads                                                                                                                                                                                         | Writes                                                                                                       | Stage status                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| authenticated shell                      | Supabase Auth session; `operators` profile; `operator_current_week`, `operator_week_status`, `operator_communications` for next-step guidance                                                         | sign out                                                                                                     | UX refinement implemented             |
| `/login`                                 | Supabase Auth session; `operators` profile for shell display                                                                                                                                          | sign in, sign out                                                                                            | Stage 3 scaffolded                    |
| `/dashboard`                             | `operator_current_week`, `operator_week_status`, `operator_week_sessions`, `operator_order_runs`, `operator_autopilot_status`, `operator_audit_events`                                                | none                                                                                                         | Stage 8 autopilot card implemented    |
| `/weeks`                                 | `operator_weeks`                                                                                                                                                                                      | none                                                                                                         | Implemented                           |
| `/weeks/[weekStart]`                     | `operator_week_status`, `operator_week_sessions`, `operator_order_runs`, `operator_audit_events`                                                                                                      | none                                                                                                         | Implemented                           |
| `/weeks/[weekStart]/menu`                | `operator_menu_setup`, `operator_validation_summary`                                                                                                                                                  | menu offers, variant create/review/availability through RPCs                                                 | Stage 6 implemented                   |
| `/weeks/[weekStart]/validation`          | `operator_validation_summary`, `operator_order_run_issues`; future `session_validation_findings`                                                                                                      | rerun validation only after job bridge                                                                       | Stage 5 read, Stage 9 trigger         |
| `/weeks/[weekStart]/orders`              | `operator_order_runs`                                                                                                                                                                                 | create order run through Python bridge                                                                       | Stage 9 order generation implemented  |
| `/weeks/[weekStart]/orders/[orderRunId]` | `operator_order_runs`, `operator_order_run_lines`, `operator_order_run_allocations`, `operator_order_run_issues`, `operator_order_run_contacts`, `operator_manual_overrides`, `operator_audit_events` | approve, reopen, follow-up/override notes through RPCs                                                       | Stage 7 implemented                   |
| `/weeks/[weekStart]/exports`             | `operator_communications`, `operator_communication_recipients`, `operator_communication_events`, `operator_audit_events`                                                                              | first snapshot through Python bridge; repeat email-preparation event through RPC; send through Python bridge | Implemented with safety-gated sending |
| `/caterers`                              | `operator_caterers`                                                                                                                                                                                   | none for submission                                                                                          | Stage 9 implemented                   |
| `/caterers/[catererId]`                  | `operator_caterer_detail`                                                                                                                                                                             | none for submission                                                                                          | Stage 9 implemented                   |
| `/students`                              | `operator_students`                                                                                                                                                                                   | none for submission                                                                                          | Stage 9 implemented                   |
| `/students/[studentId]`                  | `operator_student_detail`                                                                                                                                                                             | none for submission                                                                                          | Stage 9 implemented                   |
| `/audit`                                 | `operator_audit_events`                                                                                                                                                                               | none                                                                                                         | Stage 5 implemented                   |
| `/autopilot`                             | `operator_current_week`, `operator_autopilot_status`, `operator_autopilot_exceptions`, `operator_exception_resolutions`, `operator_exception_resolution_options`, `operator_meal_fit_signals`, `operator_feedback_events`, `operator_caterer_quality_signals`, `operator_caterer_replies`, `operator_ai_interpretations`, `operator_audit_events`; run-owned panels are scoped to the latest autopilot/generated order run, while reply cards are anchored to the latest persisted order-run revision chain | current-week manual demo trigger; reply polling; persisted exception preview/edit/apply and dismissal through Python backend contracts; no browser-side catering rules | Stage 8D implemented                  |
| `/feedback`                              | `operator_feedback_overview`, `operator_feedback_weekly_trends`, `operator_caterer_feedback_performance`, `operator_feedback_requests`, `operator_feedback_events`, `operator_caterer_quality_signals`                                                              | queue feedback dispatch; generate signed student/manager links; refresh demo request rows through Python backend | Implemented                           |
| `/feedback/student/[token]`              | Python `GET /internal/feedback/student/{token}`                                                                                                                                                | Python `POST /internal/feedback/student/{token}` records one student feedback row and queues processing       | Implemented                           |
| `/feedback/session/[token]`              | Python `GET /internal/feedback/session/{token}`                                                                                                                                                | Python `POST /internal/feedback/session/{token}` records one manager feedback row and queues processing       | Implemented                           |
| `/settings`                              | session user, `operators`, safe app metadata                                                                                                                                                          | none for submission                                                                                          | Read-only profile implemented         |

## Implemented Operator Data Models

The first Dashboard/Weeks group below is implemented in `supabase/migrations/20260524130454_phase_4_operator_read_models.sql`. The menu setup group is implemented in `supabase/migrations/20260524154500_menu_setup_read_models_and_rpcs.sql`. The order review group is implemented in `supabase/migrations/20260524171000_order_review_read_models_and_rpcs.sql`. The caterer-email persisted-first group is implemented in `supabase/migrations/20260525100000_caterer_email_read_models_and_rpc.sql`. The caterer directory/detail group is implemented in `supabase/migrations/20260525113000_caterer_read_models.sql`. The student directory/detail group is implemented in `supabase/migrations/20260525124500_student_read_models.sql`. The autopilot data-foundation group is implemented in `supabase/migrations/20260605120000_autopilot_schema_and_read_models.sql`, with advisor-driven FK index coverage in `supabase/migrations/20260605123000_autopilot_fk_indexes.sql`. These views use `WITH (security_invoker = true)` and are granted only to `authenticated`; underlying table access is guarded by RLS policies requiring a row in `public.operators`.

`web/types/supabase.ts` is generated from the linked Supabase project and includes the full current database type surface.

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

The authenticated shell uses this view with `operator_current_week` to derive a read-only Week Workflow next action. When the current pathname includes `/weeks/[weekStart]`, the route week takes precedence over `operator_current_week`; otherwise the shell uses the current week view.

The shell may also read `operator_communications.week_start`, `order_run_id`, and `email_state` so it can distinguish a fully sent latest run from email-ready or failed snapshots. This is display guidance only: the shell must not send email, generate runs, run validation, render communication templates, or recompute menu, attendance, dietary, allocation, or quantity rules.

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
- `outbound_message_id text null`
- `in_reply_to_message_id text null`
- `reference_message_ids text[] null`
- `thread_status text`
- `exported_at timestamptz null`
- `exported_by text null`
- `line_count integer`
- `total_quantity integer`
- `event_count integer`
- `latest_event_at timestamptz null`

One row per order-run/caterer represented in persisted order lines. Communication fields are nullable when a snapshot is missing. `thread_status` is display-only evidence derived from persisted RFC `Message-ID`, `In-Reply-To`, and `References` fields. This view displays persisted snapshots only; it does not build communication text.

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

### `operator_students`

- `student_id uuid`
- `student_name text`
- `school_id uuid`
- `school_name text`
- `year_level smallint`
- `subjects text null`
- `opted_out boolean`
- `dietary_raw text null`
- `dietary_tags text[]`
- `dietary_tag_details jsonb`
- `warning_count integer`
- `pending_warning_count integer`
- `enrolment_count integer`
- `absence_count integer`
- `latest_order_run_id uuid null`
- `latest_order_week_start date null`
- `latest_order_run_status text null`
- `latest_allocation_count integer`
- `latest_allocated_count integer`
- `latest_not_allocated_count integer`
- `latest_allocation_statuses text[]`
- `first_session_date date null`
- `last_session_date date null`
- `source_file text null`
- `student_email text null`
- `parent_name text null`
- `parent_email text null`
- `parent_mobile text null`

One row per student. The view exposes source profile/contact fields, school/year/subjects, opt-out state, stored dietary tags/warning counts, enrolment/absence counts, and latest persisted allocation counts/statuses. It does not expose `students.source_row` and does not recalculate attendance, exclusions, dietary safety, allocation, or quantities.

### `operator_student_detail`

Includes all `operator_students` profile/contact columns plus:

- `dietary_warnings jsonb`
- `enrolments jsonb`
- `absences jsonb`
- `latest_allocations jsonb`
- `manual_overrides jsonb`
- `audit_events jsonb`

One row per student with JSON arrays for operator drilldown sections. Allocation rows are the latest persisted order-run allocations only. Override and audit arrays include records directly tied to the student id in `entity_id`, `before_state.student_id`, or `after_state.student_id`. The detail view remains read-only and does not expose raw source JSON.

### `operator_autopilot_status`

- `autopilot_run_id uuid`
- `week_start date`
- `idempotency_key text`
- `status text`
- `trigger_source text`
- `started_at timestamptz`
- `completed_at timestamptz null`
- `summary text null`
- `generated_order_run_id uuid null`
- `exception_count integer`
- `open_exception_count integer`
- `blocking_exception_count integer`
- `emails_prepared_count integer`
- `emails_sent_count integer`
- `ai_interpretation_count integer`
- `communication_count integer`
- `sent_communication_count integer`
- `failed_communication_count integer`
- `requires_human_review boolean`
- `metadata jsonb`

One row per latest autopilot run/week. This view exposes stored run status, persisted exception counts, and persisted communication state. It does not execute gates, approve runs, create snapshots, send email, or recompute ordering rules.

### `operator_automation_jobs`

One browser-safe row per durable automation job, exposing job type, lifecycle
status, current stage, real progress percentage, stored counters/results,
failure detail, actor, linked autopilot run, attempts, and timestamps. The
operator UI polls this view while work is active; Python workers exclusively
claim and mutate jobs.

### `operator_automation_job_events`

Append-only stage history for queued jobs. Events record queued, started,
stage-changed, retry, completion, and failure states without duplicating
ordering or reply-handling decisions.

### `operator_automation_schedule`

One row for the caterer-reply schedule, exposing the Brisbane timezone,
daytime/overnight intervals, last check/success, next check, latest result or
error, and worker heartbeat. The browser uses these persisted timestamps for
the countdown and worker-offline state.

### `operator_autopilot_exceptions`

- `exception_id uuid`
- `autopilot_run_id uuid null`
- `week_start date`
- `severity text`
- `category text`
- `title text`
- `detail text`
- `recommended_action text null`
- `status text`
- `ai_confidence numeric null`
- `student_id uuid null`
- `student_name text null`
- `session_id uuid null`
- `session_date date null`
- `school_name text null`
- `caterer_id uuid null`
- `caterer_name text null`
- `order_run_id uuid null`
- `dish_variant_id uuid null`
- `dish_variant_name text null`
- `metadata jsonb`
- `created_at timestamptz`
- `resolved_at timestamptz null`
- `resolved_by uuid null`
- `resolved_by_name text null`
- `resolved_note text null`

This is the operator exception inbox for autopilot failures, accepted-cost warnings, refused AI/reply handling, validation blocks, and meal-fit review cases. It displays stored exception facts only.

Reply exceptions additionally expose `caterer_reply_id`,
`complete_interpreted_summary`, `original_reply_body`,
`deterministic_block_reason`, latest resolution status/message, and resulting
run/communication references. Historical summary fallback is AI summary,
exception detail, stored handling summary, then subject.

### `operator_exception_resolutions`

One browser-safe row per durable resolution preview, including proposed/edited
actions, proposed/final message text, deterministic validation report, lifecycle
status, creator/applier identity, failure detail, and resulting run/communication
references.

### `operator_exception_resolution_options`

One row per current order item or same-caterer dish variant available to the
resolution editor. The view exposes availability and operator-review state only;
Python remains responsible for safety and apply eligibility.

### `operator_meal_fit_signals`

- `order_run_id uuid`
- `week_start date`
- `allocation_id uuid`
- `student_id uuid`
- `student_name text`
- `school_id uuid`
- `school_name text`
- `session_id uuid`
- `session_date date`
- `chosen_dish_variant_id uuid null`
- `chosen_display_name text null`
- `scoring_version text`
- `chosen_score numeric null`
- `top_feasible_variant_id uuid null`
- `top_feasible_display_name text null`
- `top_feasible_score numeric null`
- `constrained_by text[]`
- `positive_factors jsonb`
- `negative_factors jsonb`
- `fit_debt_applied numeric`
- `novelty_applied numeric`
- `explanation text`
- `latest_fit_debt_score numeric null`
- `latest_fit_debt_reason text null`
- `preference_signals jsonb`
- `created_at timestamptz`

One row per persisted meal-fit allocation explanation. Preference summaries and latest fit debt are read for display only; SQL does not score candidates, check safety, or choose meals.

### `operator_feedback_events`

- `feedback_id uuid`
- `feedback_type text`
- `created_at timestamptz`
- `source text`
- `student_id uuid null`
- `student_name text null`
- `session_id uuid null`
- `session_date date null`
- `school_name text null`
- `dish_variant_id uuid null`
- `dish_variant_name text null`
- `caterer_id uuid null`
- `caterer_name text null`
- `rating smallint null`
- `liked boolean null`
- `delivery_status text null`
- `leftover_level text null`
- `free_text text null`
- `requested_food text null`
- `issue_tags text[]`
- `metadata jsonb`

Combined student meal feedback and session-manager catering feedback stream. Feedback parsing and derived preference updates are backend-owned, not performed in this view.

### `operator_feedback_requests`

- `request_id uuid`
- `audience text`
- `status text`
- `order_run_id uuid null`
- `week_start date null`
- `session_id uuid`
- `session_date date`
- `dinner_time time null`
- `manager_name text null`
- `school_name text`
- `student_id uuid null`
- `student_name text null`
- `caterer_id uuid null`
- `caterer_name text null`
- `order_allocation_id uuid null`
- `email_to text null`
- `eligible_at timestamptz`
- `expires_at timestamptz`
- `sent_at timestamptz null`
- `submitted_at timestamptz null`
- `send_count integer`
- `response_student_feedback_id uuid null`
- `response_session_feedback_id uuid null`
- `last_error text null`
- `metadata jsonb`

Browser-safe invitation status. Signed tokens are not stored or exposed; the operator page asks the Python backend to sign a manager link for a specific request id.

### `operator_feedback_overview`

Weekly aggregate counts for request volume, submissions, student ratings, manager issues, and quality events. This view aggregates stored facts only; it does not calculate preference weights or caterer penalties.

### `operator_feedback_weekly_trends`

Weekly request/submission counts and response rate for the `/feedback` trend panel.

### `operator_caterer_feedback_performance`

One row per caterer combining stored student feedback, manager feedback, and quality event counts. Python-owned scoring still consumes the base feedback/quality tables, not this display view.

### `operator_caterer_quality_signals`

- `caterer_id uuid`
- `caterer_name text`
- `quality_event_count integer`
- `serious_event_count integer`
- `review_event_count integer`
- `latest_event_at timestamptz null`
- `recent_events jsonb`

One row per caterer with stored quality events. The view does not calculate caterer penalties or meal-fit weights.

### `operator_caterer_replies`

- `reply_id uuid`
- `communication_id uuid null`
- `order_run_id uuid null`
- `week_start date null`
- `caterer_id uuid null`
- `caterer_name text null`
- `provider text null`
- `provider_thread_id text null`
- `provider_message_id text null`
- `in_reply_to_message_id text null`
- `reference_message_ids text[]`
- `linked_outbound_message_id text null`
- `from_email text null`
- `subject text null`
- `received_at timestamptz`
- `parsed_intent text null`
- `handled_status text`
- `confidence numeric null`
- `handled_at timestamptz null`
- `handling_summary text null`
- `ai_interpretation_id uuid null`
- `ai_model text null`
- `ai_prompt_version text null`
- `ai_needs_human_review boolean null`
- `ai_parsed_output jsonb null`
- `revised_communication_id uuid null`
- `revised_email_state text null`
- `revised_outbound_message_id text null`
- `revised_parent_message_id text null`
- `revised_reference_message_ids text[] null`
- `revised_thread_status text`
- `metadata jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Reply intake display for real inbound caterer email handling. The view exposes parsed status, AI provenance, inbound threading headers, and persisted evidence that a revised email was sent in the original thread. It does not auto-handle replies or recompute threading in TypeScript.

### `operator_ai_interpretations`

- `ai_interpretation_id uuid`
- `purpose text`
- `provider text`
- `model text`
- `prompt_version text`
- `schema_version text`
- `input_hash text`
- `parsed_output jsonb`
- `confidence numeric null`
- `needs_human_review boolean`
- `student_meal_feedback_id uuid null`
- `session_catering_feedback_id uuid null`
- `caterer_reply_id uuid null`
- `autopilot_exception_id uuid null`
- `exception_week_start date null`
- `exception_title text null`
- `reply_caterer_id uuid null`
- `reply_caterer_name text null`
- `metadata jsonb`
- `created_at timestamptz`

AI provenance display for closed-taxonomy tagging, feedback parsing, reply interpretation, and exception explanation. Full raw inputs/outputs remain in the operational table for backend audit; this view exposes parsed output and provenance for operators.

## Deferred Data Models

The following contracts remain planned and should be added only when the corresponding page slice or audited write contract is ready.

## Write Contracts

All website writes are called from Server Actions. The Server Action validates request shape with Zod, resolves the signed-in operator, calls an audited backend/database contract, and revalidates affected routes.

| Operation                      | Contract owner                                         | Required audit                                             | Status                                             |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| Create dish variant            | `operator_create_dish_variant` RPC                     | `dish_variant_created`                                     | Implemented                                        |
| Review dish variant flags      | `operator_review_dish_variant` RPC                     | `dish_variant_reviewed`                                    | Implemented                                        |
| Change variant availability    | `operator_update_dish_variant_availability` RPC        | `dish_variant_availability_updated`                        | Implemented                                        |
| Save menu offers               | `operator_save_menu_offers` RPC                        | `menu_offers_updated` with before/after variant id arrays  | Implemented                                        |
| Approve order run              | `operator_approve_order_run` RPC                       | `order_run_approved`                                       | Implemented                                        |
| Reopen order run               | `operator_reopen_order_run` RPC                        | stored `order_run_unapproved`, displayed as "Reopen run"   | Implemented                                        |
| Record follow-up/override note | `operator_record_manual_override` RPC                  | `manual_override_created`                                  | Implemented                                        |
| Create caterer email snapshot  | Python `POST /internal/caterer-email-snapshots` bridge | `communication_exported`                                   | Implemented                                        |
| Record prepared caterer email  | `operator_record_caterer_email_preparation` RPC        | `communication_exported`                                   | Implemented for existing snapshots                 |
| Send caterer email             | Python `POST /internal/caterer-email-sends` bridge     | `communication_sent` or `communication_send_failed`        | Implemented with mandatory test-recipient override |
| Trigger order generation       | Python `POST /internal/order-runs` bridge              | `order_run_generated`                                      | Implemented                                        |
| Queue autopilot run            | Python `POST /internal/automation-jobs/autopilot`      | `automation_job_queued`, terminal job audit                | Implemented                                        |
| Check caterer replies now      | Python `POST /internal/automation-jobs/caterer-reply-poll` | queued/terminal job audit; reply handling retains its own audit | Implemented                                    |
| Check feedback now             | Python `POST /internal/automation-jobs/feedback-dispatch` | queued/terminal job audit; request creation/send audits    | Implemented                                        |
| Submit student feedback        | Python `POST /internal/feedback/student/{token}`       | `feedback_recorded`, queued processing job                 | Implemented; public token route, no Supabase anon writes |
| Submit manager feedback        | Python `POST /internal/feedback/session/{token}`       | `feedback_recorded`, queued processing job                 | Implemented; public token route, no Supabase anon writes |
| Generate manager feedback link | Python `GET /internal/feedback-requests/{requestId}/link` | none                                                       | Implemented; operator-only Server Action           |
| Generate exception preview     | Python `POST /internal/exception-resolution-previews`  | `exception_resolution_proposed`                            | Implemented                                        |
| Edit/revalidate preview        | Python `PUT /internal/exception-resolution-previews/{id}` | persisted validation report                             | Implemented                                        |
| Apply exception preview        | Python `POST /internal/exception-resolution-previews/{id}/apply` | `order_run_revised` when needed, communication audit, resolution/failure audit | Implemented |
| Dismiss reply exception        | Python `POST /internal/autopilot-exceptions/{id}/dismiss` | `autopilot_exception_dismissed`                         | Implemented                                        |
| Trigger validation preflight   | Python job bridge                                      | job audit/status row; future `session_validation_findings` | Deferred to Stage 9                                |

## Deferred Data Contracts

### `session_validation_findings`

A persisted findings table is useful before live operations because it lets the UI display the full Python validation output without running the CLI during a request. It is not required before Stage 1 and is not required for the first read-only submission slice if `operator_validation_summary` is explicit about being a readiness summary.

When added, it should be written by `src/padea_catering.validation`, not by the Next.js app.

### Communication snapshot creation

The web UI can preview persisted communication snapshots, record repeat preparation events for existing snapshots, and create a missing immutable snapshot through the narrow Python backend bridge. The bridge is intentionally email-only: Next.js validates the operator request, resolves the database-owned operator display name, then calls `POST /internal/caterer-email-snapshots` with `PADEA_BACKEND_SHARED_SECRET`. The Python backend owns service-role Supabase access and calls `record_communication_export(...)`, so subject/body/rendered text and safety checks stay out of TypeScript.

The UI should handle both cases:

- snapshot exists: display it
- snapshot missing: show a reason form that creates the snapshot through the Python bridge

### Caterer email sending

The web UI can send persisted caterer email snapshots only through `POST /internal/caterer-email-sends`. Next.js validates `{ orderRunId, communicationIds, reason }`, resolves the operator display name from `public.operators`, and calls the bridge with `PADEA_BACKEND_SHARED_SECRET`.

The Python backend owns service-role Supabase access, Gmail SMTP credentials, provider selection, and delivery-state writes. It validates that the run is approved and issue-free, every requested communication snapshot exists, each snapshot has recipient rows, status is `exported` or `failed`, and the reason is non-empty. It records either:

- `order_communication_events.event_type = 'sent'` and `audit_log.action = 'communication_sent'`
- `order_communication_events.event_type = 'send_failed'` and `audit_log.action = 'communication_send_failed'`

`operator_communications` exposes `sent` and `failed` email states plus latest send event metadata/error for the exports page. `operator_communication_events` exposes provider/error metadata for event history. The current safety-gated send path requires `PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE`; real-recipient sending and website-editable SMTP settings are deferred until encrypted secret management exists.

### Website order generation

The web UI can create a new persisted order run through the narrow Python backend bridge. Next.js validates `{ weekStart, reason? }`, resolves the operator display name from `public.operators`, and calls `POST /internal/order-runs` with `PADEA_BACKEND_SHARED_SECRET`. The Python backend owns service-role Supabase access, calls `generate_order_run(...)`, supersedes prior `blocked`/`generated` runs through existing ordering logic, and writes one `order_run_generated` audit row with actor, reason, result counts, week start, and the previously supersedable run ids.

This is generation-only. The web UI does not delete order runs, run validation preflight, shell out, queue background jobs, or recalculate allocations in TypeScript.

### Manual override application

The website can record follow-up/override notes, but it must not mutate generated allocations or order lines until override application logic is designed and implemented.

The UI may expose the existing override intent types: `allocation`, `order_line`, `student_attendance`, `dietary_resolution`, `contact`, and `other`.

Future individual meal editing must be a separate audited backend contract. It should validate eligible replacement variants, update the affected allocation and order-line totals transactionally, preserve before/after state, and make clear that the run has diverged from the deterministic generator output.
