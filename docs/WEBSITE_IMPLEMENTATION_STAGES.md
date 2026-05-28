# Website Implementation Stages

**Status**: Planning guide; Stage 1 scaffold, menu setup, order review/approval, caterer email snapshots, audit read, validation read, caterer read, and student read slices implemented
**Last updated**: 2026-05-25
**Related docs**:

- [Operator Website Plan](WEBSITE_PLAN.md)
- [Design Handoff](design.md)
- [Website Data Contracts](WEBSITE_DATA_CONTRACTS.md)
- [D-14 - Operator UI is Next.js + Supabase, not Streamlit](DECISIONS.md#d-14---operator-ui-is-nextjs--supabase-not-streamlit)
- [Current Project Stage](current_stage.md)

## Purpose

This document breaks the operator website into implementation stages that can be built and reviewed safely. The goal is to avoid a single large website build that accidentally duplicates Python-owned catering logic, bypasses Supabase security, or ships unaudited operator writes.

The production website lives in `web/`. The Claude Design export in `docs/design-handoff/` is visual reference material only.

## Non-Negotiable Boundaries

- Do not mutate files in `data/raw/`.
- Do not expose the Supabase service-role key to `web/`.
- Do not allow anonymous reads.
- Do not duplicate ingestion, validation, allocation, dietary, exclusion, absence, ordering, or quantity rules in TypeScript.
- Do not add unaudited writes for approvals, reopen actions, caterer emails, manual overrides, dietary review, or menu-offer changes.
- Do not write directly to operational tables from Server Actions when an audited RPC/backend contract is required.
- Do not imply provider-confirmed delivery until a separate sent/delivery model exists. Operator-facing copy should say "Caterer emails", "Email ready", or "Not emailed yet"; avoid making preparation/downloading language the operator workflow.
- Do not copy the Claude Design JSX prototype directly into production. Re-implement with Next.js, TypeScript, Tailwind, shadcn/ui, Radix, Lucide, and Supabase SSR.
- Do not create a Python job trigger from the UI until a deliberate HTTP or queue bridge exists.

## Stage 0 - Readiness Inventory

**Goal**: Confirm what the website can read and write before scaffolding UI around assumptions.

**Tasks**

- Review existing Supabase migrations and generated schema shape.
- Map `docs/WEBSITE_PLAN.md` routes to existing tables, views, functions, and missing contracts.
- Identify which screens can be read-only first.
- Identify which writes already have audited backend/database contracts.
- List missing Phase 4 requirements: RLS policies, `security_invoker` views, generated TypeScript types, and operator auth assumptions.
- Update `docs/WEBSITE_DATA_CONTRACTS.md` with the current screen-to-data map, view sketches, and write-contract statuses.

**Exit criteria**

- `docs/WEBSITE_DATA_CONTRACTS.md` has a current screen-to-data map.
- Every planned write is marked as supported, blocked, or deferred.
- Any unresolved ambiguity is recorded in `docs/EDGE_CASES.md` or a follow-up section.

**Do not**

- Scaffold UI before knowing whether the data path is read-only, write-backed, or deferred.
- Invent browser-facing views without checking RLS and Data API exposure.

## Stage 1 - Web Foundation

**Current status**: Complete for the first reviewable slice. The scaffold, auth-only Supabase helpers, operator shell, route placeholders, scripts, and browser-safe `.env.example` exist in `web/`. Full generated Supabase types should be regenerated after Phase 4; local CLI typegen currently requires Supabase CLI auth.

**Goal**: Create the base Next.js app and toolchain without implementing business workflows.

**Tasks**

- Scaffold or verify `web/` as a Next.js 16 App Router TypeScript app.
- Install and configure Tailwind, shadcn/ui, Radix primitives, Lucide, Sonner, TanStack Table, TanStack Query, React Hook Form, Zod, `@supabase/ssr`, and `@supabase/supabase-js`.
- Add lint, typecheck, format, and build commands documented in `AGENTS.md`.
- Add `.env.example` for browser-safe Supabase variables only.
- Generate `web/types/supabase.ts` from the current database.
- Create the Supabase server/client helpers under `web/lib/supabase/`.

**Exit criteria**

- `pnpm --dir web lint`, `pnpm --dir web typecheck`, and `pnpm --dir web build` can run.
- Supabase helpers are isolated and do not expose service-role credentials.
- Generated database types exist and are not hand-edited.

**Do not**

- Add app routes that pretend to have production data before RLS/read views are ready.
- Put Supabase client creation throughout components.

## Stage 2 - Design System Translation

**Goal**: Convert the design handoff into production UI primitives.

**Tasks**

- Translate `docs/design-handoff/project/colors_and_type.css` into Tailwind/theme tokens.
- Build shadcn-compatible primitives for buttons, badges, cards, alerts, tabs, inputs, tables, empty states, and app shell layout.
- Use Lucide icons in production instead of the prototype's inline icon set.
- Use the design handoff as visual reference for icon concepts, but source icons from `lucide-react`; do not treat `Icons.jsx` as the production icon inventory.
- Implement fixed status vocabulary: `Ready`, `Unreviewed`, `Generated`, `Approved`, `Email ready`, `Blocked`, `Superseded`.
- Add reusable loading, empty, error, and RLS-unavailable states.

**Exit criteria**

- The app shell, typography, status badges, table density, focus rings, and brand treatment match the design handoff closely.
- Components are production TypeScript components, not copied prototype JSX.
- Every implemented route can have a deliberate `loading.tsx` and empty state.

**Do not**

- Introduce another component library.
- Use decorative gradients, marketing sections, or illustration-heavy layouts.

## Stage 3 - Authenticated Shell

**Goal**: Establish the protected operator surface.

**Tasks**

- Implement `/login` using Supabase Auth.
- Protect authenticated routes.
- Add sidebar/topbar shell with the route structure from `docs/WEBSITE_PLAN.md`.
- Add signed-in operator menu and logout.
- Add current-week selector placeholder or read-backed selector if a safe read path exists.
- Add global readiness indicator placeholder or read-backed indicator if a safe read path exists.
- Use the D-15 auth model: email/password for submission, session user mapped to `public.operators`, no custom role claim.

**Exit criteria**

- Anonymous users cannot access operator routes.
- Auth/session logic is isolated under `web/lib/supabase/`.
- The shell can render placeholder route bodies without business writes.
- Any real actor display name comes from `public.operators`, not user metadata.

**Do not**

- Treat React state as an authorization boundary.
- Use user-editable metadata for authorization decisions.

## Stage 4 - Phase 4 Supabase Read Model

**Goal**: Add browser-safe read paths for the operator UI.

**Tasks**

- Create RLS policies for authenticated operator access.
- Create `public.operators` for auth-user to audit-display-name mapping.
- Prefer `security_invoker` views for UI read models where views are needed.
- Grant only the required access to `authenticated`.
- Keep `anon` denied for operational data.
- Add the read models sketched in `docs/WEBSITE_DATA_CONTRACTS.md` for dashboard, weeks, week overview, validation summaries, order runs, caterer emails, audit, caterers, and students as needed.
- Add the active-week read model from D-16 rather than an active-week config table.
- Extend `audit_log.action` for menu setup audit coverage before Stage 6: `dish_variant_created`, `dish_variant_reviewed`, `dish_variant_availability_updated`, and `menu_offers_updated`.
- Add or plan web-callable RPC/write contracts for Stage 6-8 writes before exposing the corresponding UI controls.
- Run Supabase advisors after schema/security changes.
- Regenerate `web/types/supabase.ts`.

**Exit criteria**

- Authenticated browser reads work through RLS.
- Anonymous reads fail.
- Views do not bypass RLS.
- `public.operators` resolves the signed-in operator display name for audited writes.
- `docs/WEBSITE_DATA_CONTRACTS.md` matches the generated read model names and write contract names.
- Supabase advisors have been reviewed and relevant issues resolved or documented.

**Do not**

- Use `SECURITY DEFINER` to work around RLS.
- Add broad `TO authenticated` policies without an intentional access model.
- Assume views are RLS-safe without `security_invoker`.
- Use editable user metadata for authorization or audit display names.

## Stage 4a - Read Model Contracts

**Goal**: Land and type browser-safe views before screens consume them.

**Tasks**

- Implement the first required view group from `docs/WEBSITE_DATA_CONTRACTS.md`.
- Regenerate `web/types/supabase.ts`.
- Add thin typed query helpers where generated view types need narrowing or display mapping.
- Verify anonymous reads fail and authenticated operator reads succeed.

**Exit criteria**

- The next screen being built has a typed read source.
- View contracts are reflected in `docs/WEBSITE_DATA_CONTRACTS.md`.

**Do not**

- Build a page against guessed columns.
- Recompute Python-owned validation/allocation rules inside a view.

## Stage 5 - Read-Only Operational Views

**Goal**: Build the first usable website slice without operator writes.

**Tasks**

- Implement Dashboard against typed read models.
- Implement Weeks index and Week overview against typed read models.
- Implement Validation read view using `operator_validation_summary`; later adopt persisted `session_validation_findings` if that table is added. Implemented for readiness summaries and latest persisted order-run issues.
- Implement Orders index and Order run detail read views.
- Implement Caterer Emails read view showing persisted snapshots, recipients, rendered drafts, and email preparation events.
- Implement Audit read view with filters and detail drawer.
- Implement Caterers and Students read/detail pages as inspection surfaces.

**Exit criteria**

- Operators can inspect the current weekly catering state without Streamlit.
- Every route has loading, empty, and permission/error states.
- Tables are typed and use the generated Supabase types or typed query mappers.

**Do not**

- Add disabled buttons that imply unsupported writes are available.
- Recompute safety-critical validation or allocation status in TypeScript.
- Render communication templates in TypeScript.

## Stage 6 - Menu Setup Writes

**Goal**: Port the menu setup workflow from the Streamlit MVP into audited web actions.

**Tasks**

- Add Server Actions for supported menu setup writes that call audited RPC/backend contracts.
- Support weekly offer selection/deselection.
- Support variant creation where the database/backend contract supports it.
- Support variant availability changes.
- Support dietary and ingredient flag review with reason capture and actor/timestamp metadata.
- Add Zod schemas shared by forms and Server Actions.
- Revalidate affected read paths after writes.

**Exit criteria**

- Menu setup parity with `app/menu_setup_mvp.py` for supported operations.
- Every safety-relevant change records the required audit metadata, including central `audit_log` rows for the actions listed in D-17.
- Invalid or incomplete review submissions fail loudly.

**Do not**

- Infer dietary safety in the UI.
- Save review changes without a reason when the domain requires one.
- Hide unreviewed customisable variants.
- Update `dish_variants` or `menu_offers` directly from TypeScript without an audited write contract.

## Stage 7 - Order Review And Approval Writes

**Status**: Implemented for order-run list/detail, searchable review tables, approval, reopen, and audited follow-up/override notes. Caterer email preparation is implemented in Stage 8.

**Goal**: Port order review, approval, reopen, and manual-override intent workflows.

**Tasks**

- Add order run approval Server Action using existing audited backend/database contracts, preferably RPCs.
- Disable approval for blocked or issue-bearing runs.
- Add reopen action with required reason capture.
- Add manual override intent recording without implying allocation mutation.
- Surface approval history, reopen history, manual override history, and scoped audit timeline near the relevant action.
- Add search, filters, and sorting to order-line and allocation tables so operators can find rows before recording follow-up notes.
- Use human-readable selectors for affected allocation, order-line, contact, or whole-run notes; do not expose raw UUID entry to operators.

**Exit criteria**

- Order review parity with the approval/reopen portions of `app/order_review_mvp.py`.
- Approval/reopen actions produce audit records.
- Blocked states are concrete and cannot be bypassed in the UI.

**Do not**

- Mutate generated allocations or order lines until override application logic exists.
- Approve runs based only on client-side checks.
- Display `order_run_unapproved` verbatim; map it to "Reopen run" in UI copy.

## Future Stage - Audited Individual Meal Editing

**Goal**: Let operators change a student's assigned meal only through a backend-owned audited contract.

**Tasks**

- Design an `operator_apply_allocation_override`-style contract that validates the order run, selected allocation, eligible replacement variant, dietary safety, and affected order-line totals.
- Require actor, reason, timestamp, before/after state, and central audit-log rows.
- Recalculate only the affected persisted allocation/order-line facts transactionally; do not implement dietary or quantity rules in TypeScript.
- Make the UI clearly distinguish applied meal edits from follow-up notes that do not mutate order facts.

**Do not**

- Add direct table updates from the UI.
- Let operators choose unsafe variants.
- Hide that an edited run has diverged from the deterministic generator output.

## Stage 8 - Caterer Email Workflow Writes

**Status**: Implemented. The web UI displays existing immutable snapshots, can append audited preparation events for those snapshots, and can create missing first snapshots through the narrow Python email bridge.

**Goal**: Port deterministic caterer email snapshot tracking into the web app.

**Tasks**

- Render persisted caterer communication snapshots only.
- Show recipient snapshots, delivery notes, subject/body/rendered text, template version, and email preparation events.
- Add Server Action to record a prepared caterer email through an audited RPC/backend contract for existing snapshots.
- Add Server Action to create missing first snapshots through `POST /internal/caterer-email-snapshots`.
- Preserve first-snapshot immutability and append repeated email preparation events.

**Exit criteria**

- Persisted caterer email workflow parity with the snapshot-review portions of `app/order_review_mvp.py`.
- Email preparation events are persisted and visible in the audit trail.
- Missing first snapshots can be created without rendering Python-owned email templates in TypeScript.
- UI language uses "Caterer emails" as the operator workflow name.

**Do not**

- Add live email sending.
- Mutate an existing communication snapshot during repeated email preparation recording.
- Build subject/body/rendered text in TypeScript.
- Create missing communication snapshots in TypeScript.

## Stage 9 - Python Job Bridge

**Status**: v1 order-generation bridge implemented. Ingestion, validation preflight, queues, cancellation, retries, and job-status history remain deferred.

**Goal**: Add optional UI triggers for broader Python-owned jobs only after an explicit bridge is designed. The first slice is intentionally narrow and synchronous: website order generation calls FastAPI, Python persists the run, and `order_runs` plus `audit_log` are the persisted status trail.

**Tasks**

- Use a small authenticated FastAPI endpoint for order generation.
- Trigger order generation through the bridge without importing or duplicating Python logic in Next.js.
- Record actor, reason, requested week, generated run id, result counts, and prior supersedable run ids in `audit_log`.
- Surface the generated order run immediately in the UI after persistence.
- Keep deterministic rules in `src/padea_catering/`.

**Exit criteria**

- The UI can request supported order generation without importing or duplicating Python logic.
- Operators can see generated/blocked/superseded run state and audit history through existing read models.
- Generated outcomes remain reproducible from database state.

**Do not**

- Shell out to Python directly from Next.js request handlers.
- Reimplement ingestion, validation, or ordering algorithms in TypeScript.

## Stage 10 - QA, Accessibility, And Parity

**Status**: Parity confirmed by operator review. Additional automated Playwright/Vitest coverage remains a future hardening task, not a blocker for retiring the MVP workflow.

**Goal**: Prove the website is reliable enough to replace the Streamlit MVPs.

**Tasks**

- Add focused unit/component tests for high-risk components and Server Actions.
- Add Playwright coverage for login, read-only inspection, menu setup, approval/reopen, email preparation recording, and audit visibility.
- Add a deterministic test-data seed/reset strategy for local or Supabase branch E2E runs before Playwright. Prefer a Python helper that reuses existing ingestion/order-generation code, or a documented branch database reset flow.
- Verify keyboard focus, labels, dialogs, tables, and form errors.
- Check desktop and mobile layouts against the design handoff.
- Verify RLS-denied, empty, loading, and failed-write states.
- Compare completed workflows against Streamlit MVP outputs.

**Exit criteria**

- Website workflows reach parity with the retained MVPs. Complete by operator confirmation.
- Tests cover core operator paths.
- Accessibility and responsive issues are resolved or documented.

**Do not**

- Use deprecated Streamlit harnesses as active operator surfaces after parity confirmation.
- Declare completion with untested audited writes.

## Stage 11 - Streamlit Retirement Prep

**Status**: Complete for project direction. The Streamlit MVPs are retired/deprecated in docs; physical file/dependency removal is a separate cleanup task.

**Goal**: Remove the MVP dependency once the web app owns the operator workflow.

**Tasks**

- Document which Streamlit flows are replaced by which web routes.
- Move `app/menu_setup_mvp.py`, `app/order_review_mvp.py`, and `app/streamlit_app.py` to retired/deprecated status or remove them when approved.
- Update `docs/current_stage.md`.
- Update `docs/EDGE_CASES.md` with any remaining unresolved workflow gaps.
- Update demo/submission notes if needed.

**Exit criteria**

- The web app is the primary operator surface. Complete.
- Legacy MVP status is explicit. Complete.
- Current stage docs reflect the new focus. Complete.

**Do not**

- Reintroduce Streamlit as an operator workflow once parity has been accepted.

## Suggested Build Prompt

Use this as the high-level prompt for implementation work:

```text
Build the Next.js operator UI incrementally from docs/WEBSITE_PLAN.md, docs/WEBSITE_IMPLEMENTATION_STAGES.md, docs/WEBSITE_DATA_CONTRACTS.md, and docs/design.md. Use docs/design-handoff/ as visual reference only.

Start with the next incomplete stage. Do not implement later-stage writes early. Do not duplicate Python-owned ingestion, validation, allocation, dietary, exclusion, absence, ordering, communication-template, or quantity logic in TypeScript. Browser-facing data access must use Supabase Auth, RLS-safe reads, generated database types, and @supabase/ssr. All domain writes must go through Server Actions backed by audited database/backend contracts, preferably RPCs, and must capture actor/reason/timestamps where required.

After each stage, update relevant docs, regenerate Supabase types if migrations changed, run formatting, lint, typecheck, tests/build, and record unresolved edge cases.
```
