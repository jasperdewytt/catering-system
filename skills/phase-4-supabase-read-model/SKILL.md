---
name: phase-4-supabase-read-model
description: Implement Padea Phase 4 Supabase operator auth and browser-safe read models. Use when creating or reviewing public.operators, RLS policies, security_invoker views, authenticated grants, demo operator setup, Supabase advisors, anonymous-read verification, generated TypeScript types, or any first real operational reads for the Next.js operator website.
---

# Phase 4 Supabase Read Model

Use this with the `supabase` and `supabase-postgres-best-practices` skills.

## Required Inputs

Read before editing:

- `AGENTS.md`
- `docs/DECISIONS.md` D-15..D-17
- `docs/WEBSITE_DATA_CONTRACTS.md`
- `docs/WEBSITE_IMPLEMENTATION_STAGES.md` Stage 4/4a
- Current `supabase/migrations/`
- Current `web/types/supabase.ts`

## Hard Boundaries

- Do not expose service-role, database, or secret keys to `web/`.
- Do not create broad `TO authenticated` access without an operator membership predicate.
- Do not use `SECURITY DEFINER` to work around RLS.
- Do not create normal browser-facing views unless they are explicitly RLS-safe. Prefer `WITH (security_invoker = true)`.
- Do not grant operational table access to `anon`.
- Do not use `raw_user_meta_data` or editable JWT metadata for authorization or audit names.
- Do not recompute Python-owned allocation, dietary, absence, exclusion, quantity, validation, or communication-template logic in SQL.

## Implementation Workflow

1. Inspect current schema and policies.
   - Use migrations and Supabase metadata, not guesses.
   - Confirm current `public` tables already have RLS enabled and `anon`/`authenticated` access revoked where expected.

2. Add operator identity.
   - Create `public.operators` keyed to `auth.users.id`.
   - Store at least `id`, `display_name`, and timestamps.
   - Enable RLS.
   - Allow an authenticated user to read only their own operator row unless a wider read is explicitly justified.

3. Define the operator membership predicate.
   - Use `(select auth.uid())` and `exists (...)` patterns.
   - Keep policy predicates explicit and local to the access model.
   - Prefer helper views/functions only if they do not weaken RLS or become public `SECURITY DEFINER` surfaces.

4. Build read views from `docs/WEBSITE_DATA_CONTRACTS.md`.
   - Start with the smallest view group needed for the next page.
   - Use `CREATE VIEW ... WITH (security_invoker = true)` on Postgres 15+.
   - Keep views display-oriented: aggregate stored facts, do not implement safety-critical business rules.
   - Map stored internal tokens to operator-facing display fields only when documented, e.g. `order_run_unapproved` -> `Reopen run`.

5. Grant narrowly.
   - Grant `SELECT` on operator read views to `authenticated`.
   - Do not grant operational table access to `anon`.
   - Grant base table access to `authenticated` only when required for security-invoker view execution and backed by RLS.

6. Seed or document demo operator setup.
   - Create the Supabase Auth user through Supabase-supported auth tooling, not by inserting directly into `auth.users`.
   - Insert the matching `public.operators` row.
   - Do not commit passwords. Document credentials outside source control.

7. Verify security.
   - Anonymous read attempts must fail for operational tables and operator views.
   - Authenticated non-operator behavior must be deliberate and tested.
   - Authenticated operator reads must succeed for intended views.
   - Run Supabase security and performance advisors after migrations.

8. Regenerate types and wire only minimal reads.
   - Run `pnpm --dir web supabase:types` or Supabase MCP type generation if CLI auth/connectivity is blocked.
   - Update `web/types/supabase.ts`.
   - Add typed query helpers only for views actually used by the next UI slice.

9. Update docs and checks.
   - Update `docs/WEBSITE_DATA_CONTRACTS.md` with final view/contract names.
   - Update `docs/current_stage.md`.
   - Run relevant Supabase advisor checks plus `pnpm --dir web lint`, `pnpm --dir web typecheck`, and `pnpm --dir web build`.

## Review Checklist

- `public.operators` exists, has RLS, and maps Auth users to durable audit display names.
- Views are `security_invoker` or otherwise documented as RLS-safe.
- `anon` cannot read operational data.
- `authenticated` access is scoped by operator membership.
- No `SECURITY DEFINER` was added without explicit justification and locked-down grants.
- No frontend code uses service-role or backend-only secrets.
- No view recomputes Python-owned catering rules.
- Types and docs match the implemented schema.
