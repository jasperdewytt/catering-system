# LLM Integration Plan

_Written: 2026-05-23. Status: planned, not implemented._

This document defines where LLMs may fit into the catering system without weakening the deterministic ordering and audit guarantees already established in `AGENTS.md` and `docs/DECISIONS.md`.

The short version: LLMs may assist with messy text, summaries, explanations, and draft wording. They must not decide quantities, attendance, exclusions, dietary safety, allocations, approval, recipients, or sending.

---

## Current Baseline

The system already has deterministic support for:

- source-data ingestion from the seven raw files
- validation preflight
- variant-aware menu setup
- deterministic meal allocation and order-line generation
- order review
- approval/reopen actions with `audit_log`
- manual override recording via `manual_overrides`
- deterministic copy-ready caterer email drafts

The active backend gap is communications persistence: exported/sent caterer messages need database records and recipient snapshots before live sending is added. LLM integration should come after, or sit beside, that work. It should not block communications tracking.

---

## Non-Negotiable Boundaries

LLMs must never be the sole authority for:

- meal quantities
- absence handling
- exclusion handling
- dietary/allergy safety
- student-to-meal allocation
- contact-recipient selection for live messages
- order approval
- manual override application
- whether an email is allowed to be sent

LLMs may be used for:

- suggesting import mappings for changed spreadsheet/document formats
- summarising generated order runs for operators
- flagging possible review concerns for a human to inspect
- polishing already-deterministic email drafts
- summarising session-manager feedback
- extracting structured tags from free-text feedback
- explaining deterministic allocation decisions in human language

Every LLM output that influences operator action must be persisted with provenance: model/provider, prompt or prompt hash, response, timestamp, actor, and the human action that accepted or ignored it.

---

## Integration Principle

LLM features should be implemented as optional sidecars around deterministic data.

The preferred shape is:

```text
deterministic state
→ LLM proposes / summarises / rewrites
→ output is stored as advisory data
→ operator reviews
→ deterministic backend action records the final decision
```

The forbidden shape is:

```text
raw/ambiguous input
→ LLM decides
→ production tables are silently mutated
```

---

## Track A — LLM-Assisted Import Mapping

### Purpose

Future weekly files may not exactly match the current source format. An LLM can help map changed column names or sheet structures to the canonical ingestion schema.

Example:

```text
Campus          -> school
Weekday         -> day_label
Dinner          -> dinner_time
Contact         -> manager_name
Phone           -> manager_mobile
Caterer Name    -> caterer
```

### Required Backend Shape

Add import staging tables before any LLM-assisted import is allowed:

- `raw_uploads`
  - uploaded file metadata, checksum, original filename, uploaded actor/time
- `import_batches`
  - one attempted import run, status, source type, parser version
- `import_column_mappings`
  - source field, target field, confidence, mapping source (`deterministic`, `llm_suggested`, `operator_confirmed`)
- `import_warnings`
  - unresolved ambiguity, validation failures, unknown schools/caterers, duplicate sessions

### Flow

1. Operator uploads a new file.
2. Deterministic parser attempts known-format detection.
3. If exact match succeeds, import proceeds normally into staging.
4. If near-match or unknown format, LLM suggests a mapping.
5. Operator confirms or edits the mapping.
6. Python applies the confirmed mapping.
7. Validation checks row counts, required fields, joins, date/day assumptions, duplicate sessions, and missing values.
8. Only a validated batch can be committed to operational tables.

### Hard Rule

An LLM suggestion must never write directly to production tables. Operator confirmation plus deterministic validation is required.

---

## Track B — LLM Order Review

### Purpose

Give the operator an advisory review of an already-generated order run. This can help surface issues such as unusual quantities, missing room warnings, unverified contacts, or suspicious-looking drafts.

The LLM must not approve or reject the order run. Human approval through `approve_order_run()` remains mandatory.

### Database Plan

Do not overload `order_runs.approval_note` or a plain `audit_log.reason` string with structured LLM findings.

Add a dedicated table:

```sql
create table public.llm_reviews (
    id              uuid        primary key default gen_random_uuid(),
    order_run_id    uuid        not null references public.order_runs(id) on delete cascade,
    provider        text        not null check (length(btrim(provider)) > 0),
    model           text        not null check (length(btrim(model)) > 0),
    prompt_version  text        not null check (length(btrim(prompt_version)) > 0),
    prompt_hash     text        not null check (length(btrim(prompt_hash)) > 0),
    summary         text        not null check (length(btrim(summary)) > 0),
    verdict         text        not null check (verdict in ('no_concerns', 'concerns_found', 'unable_to_review')),
    findings        jsonb       not null default '[]'::jsonb,
    raw_response    text        not null,
    created_by      text        not null check (length(btrim(created_by)) > 0),
    created_at      timestamptz not null default now()
);

create index idx_llm_reviews_order_run_id on public.llm_reviews (order_run_id);
create index idx_llm_reviews_created_at on public.llm_reviews (created_at desc);
```

Also extend `audit_log.action` to include:

```text
llm_review_recorded
```

RLS should be enabled and anon/authenticated access revoked, matching the current service-role-only pattern until the final auth/RLS model exists.

### Backend Plan

Create `src/padea_catering/order_review/llm_reviewer.py` with pure helper functions:

- `build_order_review_prompt(review: dict) -> str`
- `parse_order_review_response(raw_response: str, provider: str, model: str) -> dict`
- `hash_prompt(prompt: str) -> str`

Create an operations action:

- `record_llm_review(client, order_run_id, provider, model, prompt_version, prompt, parsed_response, actor_name)`

This action should:

- require non-empty actor/provider/model/prompt metadata
- verify the order run exists
- insert `llm_reviews`
- insert `audit_log` action `llm_review_recorded`
- not change `order_runs.status`

### Suggested Findings Shape

```json
{
  "schema_version": "1",
  "verdict": "concerns_found",
  "summary": "Two contact warnings remain; quantities otherwise match the generated order lines.",
  "findings": [
    {
      "severity": "warning",
      "category": "contact",
      "message": "GyG primary contact uses a free-webmail address.",
      "entity_type": "caterer_contact",
      "entity_id": "..."
    }
  ]
}
```

### Prompt Constraints

The prompt must explicitly say:

- do not approve or reject the run
- do not change quantities
- do not infer dietary safety
- only flag concerns for a human operator
- return structured JSON matching the expected schema when structured output is wired in

---

## Track C — LLM Email Draft Polish

### Purpose

The deterministic email draft builder already knows the facts: quantities, sessions, delivery notes, contacts, and order lines. An LLM may rewrite that draft into a warmer or clearer tone, but it must not add, remove, or alter facts.

### Dependency on Communications Tracking

This should be implemented after communication persistence exists:

- `communications`
- `communication_recipients`
- audit action such as `communication_exported`

The LLM-polished draft should be stored as a communication body snapshot, not generated ephemerally inside the UI with no record.

### Backend Plan

Refactor email drafting only enough to make the deterministic template pluggable:

- keep the current deterministic function as the default
- introduce a `DraftBuilder` protocol or callable type
- allow `get_order_review(..., draft_builder=None)` to use the template by default
- add a separate LLM draft module that wraps the deterministic draft

The LLM draft builder should receive the deterministic draft and a strict prompt:

```text
Rewrite this catering order email in a warm, professional tone.
Keep all quantities, dates, locations, names, email addresses, phone numbers,
dietary notes, and delivery instructions exactly as written.
Do not add new facts.
Do not remove facts.
If the draft contains ambiguity, preserve it and mention it clearly.
```

### Validation

Before storing an LLM-polished draft, run deterministic checks:

- all order-line quantities from the template still appear
- all session dates still appear
- all school names still appear
- all caterer names still appear
- all contact emails still appear where required

If any check fails, reject the LLM draft and fall back to the deterministic template.

---

## Track D — Feedback Summarisation

### Purpose

After orders are delivered, session managers may provide free-text feedback. LLMs are useful here because the source material is naturally unstructured and non-safety-critical.

Examples:

- "Driver arrived 15 minutes late."
- "Students liked the burritos but several chicken bowls were left over."
- "Food was cold when it arrived."

### Backend Shape

Later phases should add:

- `session_feedback`
- `feedback_tags`
- `feedback_summaries`

An LLM may extract advisory tags:

- late_delivery
- missing_items
- food_quality
- temperature_issue
- student_preference
- contact_issue
- quantity_mismatch

The raw feedback must be stored unchanged. LLM tags/summaries are derived metadata.

---

## Provider Strategy

Do not hard-code a provider into core business modules.

Use an adapter boundary such as:

```python
class LLMClient(Protocol):
    def complete(self, prompt: str) -> str: ...
```

Provider-specific code should live outside deterministic core modules, for example:

```text
src/padea_catering/llm/
  __init__.py
  types.py
  anthropic_client.py
  openai_client.py
```

Only add provider dependencies when a feature is actually wired:

- `anthropic` only if using Anthropic
- `openai` only if using OpenAI

API keys belong in `.env` or Streamlit secrets and must never be committed.

---

## Recommended Implementation Order

1. **Communications persistence first**
   - `communications`
   - `communication_recipients`
   - deterministic export action
   - audit action for export

2. **LLM plan scaffolding**
   - provider-neutral `padea_catering.llm` types
   - no provider dependency yet

3. **LLM order review storage**
   - `llm_reviews`
   - `record_llm_review`
   - prompt builder/parser tests

4. **Optional Order Review MVP hook**
   - hidden/explicit "Run LLM review" button
   - writes `llm_reviews`
   - displays summary/findings next to human approval history

5. **LLM email polish**
   - after communication records exist
   - store deterministic template and polished draft snapshots
   - validate facts before accepting the polished draft

6. **Import mapping assistant**
   - after import staging tables exist
   - operator-confirmed mappings only

7. **Feedback summarisation**
   - after feedback capture exists

---

## Testing Expectations

LLM-facing code should be testable without real API calls.

Required tests:

- prompt builders include all required deterministic facts
- parsers reject missing schema versions or invalid verdicts
- operations actions require actor/model/provider metadata
- operations actions write both domain rows and audit rows
- email-polish validators reject altered quantities/dates/contact emails
- fallback to deterministic template works when LLM output is invalid

Integration tests with real LLM providers are optional and should not run in the default test suite.

---

## UI Expectations

The final app should present LLM output as advisory, not authoritative.

Good labels:

- "AI review suggestions"
- "Possible concerns"
- "Polished draft"
- "Use deterministic draft"
- "Accept polished draft"

Avoid labels that imply authority:

- "AI approved"
- "AI safe"
- "AI fixed"
- "Automatically resolved"

Any accepted LLM output should require a visible operator action and should write an audit row.

---

## Explicit Non-Goals

This plan does not add:

- live email sending
- automatic order approval
- automatic allergy/dietary interpretation
- automatic contact verification
- automatic import into production tables from an LLM mapping
- provider-specific API calls in the default path
- mandatory LLM dependency for running tests or generating orders

---

## Near-Term Recommendation

Do not implement LLM features immediately.

The next backend stage should remain communications persistence and export tracking. Once exported communications are durable and auditable, LLM email polish becomes a clean optional layer because the system can store both the deterministic draft and any accepted polished variant.

The first LLM feature worth implementing is probably **LLM order review storage**, because it is low-risk, advisory, and exercises the audit pattern without changing production decisions.
