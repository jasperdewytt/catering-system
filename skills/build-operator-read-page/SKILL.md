---
name: build-operator-read-page
description: Build or review a Padea Next.js operator read-only page backed by typed Supabase Phase 4 read models. Use when replacing placeholders in /dashboard, /weeks, /validation, /orders, /exports, /audit, /caterers, or /students with real data, tables, empty/loading/error states, and operator-friendly copy without domain writes or TypeScript business-rule recomputation.
---

# Build Operator Read Page

Use after the relevant Phase 4 read model exists and `web/types/supabase.ts` has been regenerated.

## Required Inputs

Read before editing:

- `AGENTS.md`
- `docs/WEBSITE_PLAN.md` page section for the route
- `docs/WEBSITE_DATA_CONTRACTS.md` read model shape
- Current route/component files under `web/app/` and `web/components/`
- Generated view types in `web/types/supabase.ts`

## Hard Boundaries

- Do not query operational base tables from browser-facing pages unless Phase 4 explicitly permits it through RLS.
- Do not add domain writes. This skill is for read-only screens.
- Do not fake live data. Use a deliberate empty state if the view is empty or unavailable.
- Do not recompute dietary safety, attendance, absence, exclusions, allocation, quantities, validation, or communication templates in TypeScript.
- Do not expose service-role or backend-only keys.
- Do not add disabled buttons that imply unsupported writes are available.

## Page Build Workflow

1. Confirm the read contract.
   - Match the route to `docs/WEBSITE_DATA_CONTRACTS.md`.
   - Confirm the view name and columns exist in `web/types/supabase.ts`.
   - If the view/type is missing, stop and complete Phase 4/4a first.

2. Add a narrow typed data helper.
   - Put reusable queries under `web/lib/` or a local route helper following existing patterns.
   - Use generated Supabase types or explicit mappers for display rows.
   - Keep mapping presentational: labels, formatting, sort order, and route links only.

3. Fetch from a Server Component by default.
   - Use `web/lib/supabase/server.ts`.
   - Use `supabase.auth.getUser()` in protected surfaces; do not trust client state for auth.
   - Add client components only for interactivity such as filters, tabs, or table controls.

4. Build the page with existing primitives.
   - Reuse `PageHeader`, `EmptyState`, `LoadingState`, cards, tables, badges, and shell components.
   - Keep dashboard copy operator-friendly: "Next task", "Tasks to complete", "Needs a decision".
   - Use Lucide icons when helpful.
   - Keep density calm and scannable; avoid marketing layouts.

5. Handle every state.
   - Loading: route `loading.tsx` or existing loading component.
   - Empty: explain what is missing in operator language.
   - Permission/error: show a safe message; do not leak SQL/policy details to the UI.
   - Partial data: show explicit missing-data states instead of inventing values.

6. Keep actions honest.
   - Link only to routes that exist.
   - For unsupported generation, approval, export, or menu-write workflows, show the next backend requirement or CLI note rather than a fake button.

7. Validate and document.
   - Run `pnpm --dir web lint`, `pnpm --dir web typecheck`, and `pnpm --dir web build`.
   - Update `docs/current_stage.md` when a route group moves from placeholder to real read-only data.
   - Update `docs/WEBSITE_DATA_CONTRACTS.md` if the view contract changes.

## Review Checklist

- Page consumes only approved read models.
- No fake data remains.
- No domain Server Action or mutation was introduced.
- Empty/loading/error states are deliberate.
- UI copy is for an operator, not a database engineer.
- Python-owned rules are displayed from persisted/read-model results, not recalculated.
- Types, docs, lint, typecheck, and build are current.
