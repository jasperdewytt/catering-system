# Decisions

Resolved edge cases with rationale. Each entry links back to the corresponding `E-NN` in `docs/EDGE_CASES.md`.

---

## D-01 — Student primary key strategy (E-01)

**Decision**: Surrogate UUID primary key on the `students` table.

`(school, full_name)` carries a soft unique constraint — a warning is raised at ingestion time if a duplicate pair is detected, but it does not hard-block the import. An operator must confirm that duplicates are genuinely two different people before any order is generated for that session.

Absence rows that match zero students, or more than one student after operator resolution, fail loud and require manual override.

**Why not natural key only**: The raw data happens to have no `(school, full_name)` collisions today, but same-name students at the same school are a real operational risk. A surrogate UUID handles future collisions gracefully without requiring a schema change.

---

## D-02 — Partial year-level exclusion model (E-03)

**Decision**: Model exclusions as `(session_id, excluded_year_levels[])` on an `exclusions` table.

- Empty array = no exclusion (row should not exist).
- Array containing all year levels present in the session = full cancellation.
- Partial cancellation = array of the excluded year levels only.

The order generator filters out any student whose year level appears in the exclusion array for their session.

**Why one model for both cases**: A separate full-cancellation table and a partial-exclusion table would split the same concept across two places. The array approach handles both uniformly and keeps the order generator logic simple.

---

## D-03 — Drop `day` column (E-11)

**Decision**: `day` is not stored in the schema. `date` is the authoritative column for delivery scheduling.

**Update (during ingestion)**: The original rationale ("`day` always matches `date.strftime('%A')`") turned out to be wrong — see [E-23](EDGE_CASES.md#e-23--day-and-date-columns-disagree-with-the-gregorian-calendar). `2026-05-02` is labelled Tuesday in the source but is actually a Saturday. The decision still stands — we don't store `day` in `sessions` — but the **ingestion pipeline reads the source `day` column** to match `students.xlsx` sheet labels (e.g. `"JPC - Tuesday"`) to sessions. Python's `strftime('%A')` would give the wrong answer for this dataset.

**Why the decision still holds**: the schema only needs the date for delivery, and downstream queries that want to display a weekday should still derive from the date (which describes when delivery happens in real-world time). The source `day` label is an operational sheet-naming artefact, not a calendrical fact worth persisting.

---

## D-04 — Null `Dietary` cell meaning (E-12)

**Decision**: Three-way interpretation at ingestion:

- `null` → no restriction; no warning raised.
- Recognised dietary tag (`Halal`, `Nut Free`, `No Beef`, etc.) → restriction recorded and applied to meal allocation.
- Unrecognised text → operator warning raised; order for that student is blocked until manually reviewed.

**Why not warn on null**: The majority of blanks (261/320) are almost certainly genuinely unrestricted students. Flagging all of them as unverified would create noise that obscures real issues. The risk is captured by warning on *unrecognised* text instead.

---

## D-05 — Multi-session enrolment model (E-14)

**Decision**: `session_enrolment` is a many-to-many join table between `students` and `sessions`. A validation rule flags any student UUID appearing in more than one session on the same date for operator review before the order runs.

**Note on Riley Turner**: The apparent same-date conflict (MBBC + ISHS-Tuesday, both 2026-05-02) is a name coincidence — confirmed two different people via different parent names, contact details, and school email domains. The UUID PK (D-01) correctly distinguishes them as separate rows.

**Why many-to-many**: Some students legitimately attend sessions at two different schools on different days. Flattening to one enrolment per student would lose valid data.

---

## D-06 — Opted-out students (E-15)

**Decision**: `opted_out boolean` lives on the `students` table, not `session_enrolment`.

Opt-out is a persistent attribute set at roster ingestion time. There is no weekly source feed that updates it, so per-session opt-out tracking is not meaningful with current data. Any change requires a manual operator override with a reason and timestamp.

Dietary restrictions are stored regardless of opt-out status — safety-relevant data is always kept (e.g. Lei Li has `Nut Free, No Shellfish` and is opted out; both facts are stored).

Opted-out students are excluded from meal counts and do not appear in generated orders.

---

## D-07 — Meaning of "menu item count" (E-17)

**Decision**: "Menu items" = number of distinct dishes on the offered menu for that week, selected by the operator before the order is generated. The applicable minimum order quantity is determined by that count.

**Pending**: stakeholder confirmation. Treat this as the working assumption until confirmed.

**Why this interpretation**: The caterer needs to know upfront how many dishes to prepare, so the offered menu count (operator-controlled) is the operationally meaningful number, not the count of dishes that happen to be ordered.
