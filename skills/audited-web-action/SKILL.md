---
name: audited-web-action
description: Implement or review Padea Next.js Server Actions for audited operator writes. Use when adding menu setup, dish variant review, offer selection, order approval/reopen, manual override intent, or communication email preparation actions that must validate with Zod, resolve actor identity, capture reason/timestamp, call RPC/backend write contracts, and avoid duplicating Python-owned catering logic.
---

# Audited Web Action

Use this only after the write contract is designed in `docs/WEBSITE_DATA_CONTRACTS.md` and backed by an audited RPC or backend endpoint.

## Required Inputs

Read before editing:

- `AGENTS.md`
- `docs/DECISIONS.md` D-10, D-13, D-15, D-17
- Relevant `docs/WEBSITE_PLAN.md` page section
- `docs/WEBSITE_DATA_CONTRACTS.md` write contract row
- Existing Python audited operation or SQL/RPC contract
- Current `web/actions/`, form components, and generated Supabase types

## Hard Boundaries

- Do not write directly to operational tables when an audited RPC/backend contract is required.
- Do not implement ordering, allocation, dietary safety, absence, exclusion, validation, quantity, or communication-template logic in TypeScript.
- Do not rely on disabled client buttons for safety. Enforce on the server/RPC.
- Do not use editable user metadata for authorization or audit display names.
- Do not allow approval/reopen/caterer-email/manual override writes without actor, reason where required, and timestamp/audit trail.
- Do not expose service-role or secret keys to `web/`.

## Implementation Workflow

1. Verify the contract exists.
   - Confirm the RPC/backend action name, parameters, return type, audit behavior, and server-side invariants.
   - If the contract is missing, implement or request the backend contract first. Do not patch around it in TypeScript.

2. Define validation.
   - Create a Zod schema for the Server Action body.
   - Share or reuse the schema with React Hook Form when a client form exists.
   - Validate ids, reason text, enum values, and expected route context.

3. Resolve actor on the server.
   - Use Supabase SSR server client and `auth.getUser()`.
   - Resolve display name from `public.operators`, not user metadata.
   - Reject unauthenticated or non-operator requests before calling the write contract.

4. Call only the audited contract.
   - Use `supabase.rpc(...)` or the approved backend bridge.
   - Keep the Server Action thin: validate, resolve actor, call contract, map result.
   - Let the contract enforce business invariants transactionally.

5. Revalidate affected routes.
   - Use `revalidatePath` for dashboard, week, order run, audit, or caterer email routes affected by the write.
   - Redirect only when the workflow expects navigation.
   - Return structured field/form errors for recoverable validation failures.

6. Build form UI honestly.
   - Require reason fields where domain requires them.
   - Show disabled/unavailable states only as guidance, not as the only safety boundary.
   - Do not show controls for unsupported writes.
   - Use Sonner toasts only in client components after the server result is known.

7. Verify audit and invariants.
   - Test successful write creates the expected audit/event rows.
   - Test blocked invalid write fails server-side.
   - Test unauthenticated/non-operator write fails.
   - Run Supabase advisors if schema/RPC changed.

8. Update docs and checks.
   - Update `docs/WEBSITE_DATA_CONTRACTS.md` contract status/name.
   - Update `docs/current_stage.md` when a workflow phase completes.
   - Run `pnpm --dir web lint`, `pnpm --dir web typecheck`, `pnpm --dir web build`, plus relevant Python tests if backend code changed.

## Review Checklist

- Server Action is thin and contract-backed.
- Zod validates every input.
- Actor is resolved from Auth plus `public.operators`.
- Required reason/timestamp/audit behavior is present.
- Server/RPC rejects unsafe states, not just the UI.
- No Python-owned catering rules are duplicated in TypeScript.
- Docs and tests/checks match the implemented write path.
