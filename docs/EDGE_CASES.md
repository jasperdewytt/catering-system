# Edge Cases

Open questions and inconsistencies surfaced while inventorying `data/raw/`. Every case is:

- **observed**, not hypothetical — the file / row / column where it lives is named, and
- **unresolved** — no behavioural decision has been made yet.

Each entry has a stable id (`E-NN`) that other docs reference. Status values:

- **open** — no decision yet
- **decided** — behaviour fixed, see linked decision
- **deferred** — will not be handled before submission; record-and-move-on

When an item is decided, leave it in this file with the decision summarised inline, and add a link to a fuller note in `docs/DECISIONS.md` (to be created).

---

## E-01 — No student ids, name-only join

- **Where**: `students.xlsx` (no id column), `absences.pdf` (names only), `exclusions.pdf` (year-levels only).
- **Observation**: Joining absences to students relies on exact full-name match. Same first-name + surname collisions are real in the data (`Charlie Morris` and `Charlie Mitchell` are different students at ISHS-Tuesday; both `Nathan Smith` and `Rose Smith` exist in different schools).
- **Risk**: A typo in absences or a duplicate name silently mis-attributes the absence, producing an incorrect meal count.
- **Status**: decided — see `docs/DECISIONS.md` D-01.
- **Decision**: Surrogate UUID primary key. `(school, full_name)` carries a soft unique constraint (warning, not hard block). Ingestion flags duplicate `(school, full_name)` pairs for operator confirmation before any order is generated. Absence rows that match zero or >1 student after operator resolution fail loud.

## E-02 — `Dietary` column content (resolved on inspection)

- **Where**: `students.xlsx`, column D (`Dietary`).
- **Observation**: An earlier exploration pass reported that this column contained email addresses (column-misalignment artefact). **Direct inspection contradicts that**: across all 320 rows, every populated `Dietary` value is a recognisable dietary phrase (`Halal`, `No Beef`, `Opted out of Catering`, etc.) — there are no email values in the column. 261 / 320 cells are empty.
- **Risk**: low (claim was wrong).
- **Status**: decided — no anomaly. Logged here only to prevent the same misreading recurring.

## E-03 — Partial year-level cancellation (Exclusion Three)

- **Where**: `exclusions.pdf`, Exclusion Three.
- **Observation**: Cannon Hill Anglican College on 2026-05-03 is cancelled for Years 12 and 10 but Year 11 still attends. The session is partially cancelled, not fully.
- **Risk**: A naive "cancel the session" parser would zero the entire meal order; a naive "ignore exclusions" parser would over-order for Y12 + Y10 students who aren't coming.
- **Status**: decided — see `docs/DECISIONS.md` D-02.
- **Decision**: model exclusions as `(session_id, excluded_year_levels[])`. Empty array = no exclusion; array containing all session year levels = full cancellation. Order generator filters students whose year level is in the list.

## E-04 — Caterer weekly minimum vs realised demand

- **Where**: `caterers.xlsx` rows 2–5 plus footer note on row 7.
- **Observation**: Minimums are *weekly totals across all schools served by that caterer*. The largest is Kenko (35 meals @ 4 items, up to 45 @ 6 items). Kenko serves ISHS only, on 3 days. After absences and the full Open-Day exclusion on 2026-05-04, ISHS attendance could fall well below 35.
- **Risk**: order falls short of minimum → caterer rejection or surcharge; or we over-order and waste meals.
- **Status**: open.
- **Proposed stance**: validation layer raises a preflight warning whenever (caterer weekly forecast meals) < (minimum for chosen menu-item count). Operator decides between: top-up (over-order), reduce menu-item count to lower the minimum, or notify caterer.

## E-05 — Free-text dietary strings vs structured menu flags

- **Where**: `students.xlsx.Dietary` (free text) ↔ `caterer-menus.pdf` flags (GF / DF / NF / VO).
- **Observation**: Student diets include concepts the menu flags don't expose:
  - "Halal" (menu rule says infer from absence of pork — see [E-19](#e-19-halal-is-inferred-not-tagged))
  - "No Fish", "No Shellfish", "No Seafood" (no menu flag exists)
  - "No Beef", "No Red Meat", "No Pork" (no menu flag exists)
  - "Vegetarian" (menu uses `VO` = vegetarian *option*)
  - "Opted out of Catering" (not a dietary restriction; see [E-15](#e-15-opted-out-of-catering-is-an-attendance-flag-not-a-diet))
- **Risk**: students get meals that violate their stated restrictions, or are excluded from menus they could safely eat.
- **Status**: decided — see `docs/DECISIONS.md` D-08.
- **Decision**: Structured student tags are matched deterministically against dish dietary fields and operator-reviewable ingredient flags. Unknown student dietary text creates a pending warning and blocks automatic allocation until operator resolution.

## E-06 — Caterer capacity overlap

- **Where**: `caterer-contacts.pdf`, `Serves` vs `Able to serve` lists.
- **Observation**: Three caterers list schools they *could* serve beyond their current assignments (Lakehouse → CHAC; Terrific → LC; GyG → MSHS). `sessions.xlsx` already fixes the assignment.
- **Risk**: none operationally for this week — `sessions.xlsx` is authoritative. But useful as a fallback set if a caterer drops out or a minimum can't be met by reassignment.
- **Status**: deferred for this submission. Capture the data, do not use it for routing yet.

## E-07 — Repeated manager first names

- **Where**: `sessions.xlsx.manager`.
- **Observation**: `Jessie` appears at JPC-Tuesday and MSHS-Thursday (same mobile `0412 345 678` — one person). `Ethan` appears at ISHS-Thursday and CHAC-Monday (same mobile `0498 877 665` — one person). Different days each time, so the duplication is real-world, not a data bug.
- **Risk**: low for this week, but if a future row had the same first name and a different mobile, we'd need a proper `managers` table.
- **Status**: open.
- **Proposed stance**: treat `(manager first name, mobile)` as the natural key for now; later promote to a `managers` table if more data lands.

## E-08 — GST inclusivity varies across caterers

- **Where**: `caterer-menus.pdf` heading lines.
- **Observation**: Lakehouse and Terrific quote prices *excluding* GST; Kenko and Guzman quote *including* GST.
- **Risk**: order cost summaries mis-state totals if the system treats the per-item price uniformly.
- **Status**: open.
- **Proposed stance**: store `(price_ex_gst, gst_rate, price_inc_gst)` per dish; show one canonical column in reports.

## E-09 — Pseudonymous and suspicious caterer emails

- **Where**: `caterer-contacts.pdf`.
- **Observation**:
  - GyG primary email is `carmengabrielleee@gmail.com` — a near-look-alike of Lakehouse's `carmen@padea.com.au` (the legitimate Padea-domain address).
  - Two Padea-domain addresses (`carmen@padea.com.au`, `dylan@padea.com.au`) appear as caterer contacts, suggesting either staff act as proxies or the data is adversarial.
  - Several contacts use clearly pseudonymous names (`Big Mom`, `Big Chicken`, `Medium Giraffe`).
- **Risk**: order emails could be routed to the wrong party, or to a spoofed address.
- **Status**: open.
- **Proposed stance**: surface contact data verbatim with a verification flag; do not auto-send to gmail.com addresses without operator confirmation. Belongs in operator review UI.

## E-10 — Times stored as strings

- **Where**: `sessions.xlsx`, columns `start-time`, `end-time`, `dinner-time`.
- **Observation**: Stored as `"4:00pm"` etc., not Excel TIME types.
- **Risk**: low, but arithmetic ("how long until dinner?") needs parsing.
- **Status**: open.
- **Proposed stance**: parse to `time` at ingestion; preserve original string for audit.

## E-11 — `day` redundant with `date`

- **Where**: `sessions.xlsx`.
- **Observation**: `day` column ("Tuesday") is always `date.strftime('%A')`. Verified on all 11 rows.
- **Risk**: if the two ever disagree, which wins?
- **Status**: decided — see `docs/DECISIONS.md` D-03.
- **Decision**: `date` is authoritative. `day` is dropped from the schema; recomputed on display.

## E-12 — Empty `Dietary` cell — meaning

- **Where**: `students.xlsx`, 261/320 rows have `Dietary` = null.
- **Observation**: No accompanying flag distinguishes "we asked and they have no restriction" from "we never asked / unknown".
- **Risk**: assuming "no restriction" means a student with an unrecorded allergy is offered the wrong meal.
- **Status**: decided — see `docs/DECISIONS.md` D-04.
- **Decision**: null = no restriction, no warning. Recognised tag = restriction applied. Unrecognised text = operator warning, manual review required before order proceeds.

## E-13 — Dishes with no dietary tag

- **Where**: `caterer-menus.pdf`. 8 of 40 dishes carry no flag at all:
  Beef Pad Thai; Bacon Carbonara; Creamy Udon; Mongolian Beef and Rice; Cali Burrito; Grilled Chicken Burrito; Chicken Quesadilla; Crispy Chicken Taco.
- **Observation**: Ambiguous whether absent-tag means "contains everything" (gluten, dairy, nuts, animal) or "unknown".
- **Risk**: if treated as unrestricted, a NF student could be assigned Bacon Carbonara without anyone noticing.
- **Status**: decided — see `docs/DECISIONS.md` D-08.
- **Decision**: treat absent-tag as "no claim made" (i.e. assume not GF / not DF / not NF / not VO). Untagged dishes may be offered to unrestricted students. For restricted students, `unreviewed` ingredient flags block allocation; `keyword_inferred` flags are allowed only as a deterministic development bridge and validation warning until operator review.

## E-14 — Students attending multiple sessions

- **Where**: `students.xlsx`. 13 students appear in two different sheets:
  Zachary Anderson (MBBC + CHAC-Wed); Riley Turner (MBBC + ISHS-Tue); Bailey Roberts, Benjamin Wilson, Samuel Martin (JPC-Tue + ISHS-Tue); + 8 more.
- **Observation**: Multi-enrolment is real. Two of the cases collide on the same date (Tuesday MBBC + ISHS-Tue both on 2026-05-02 — Riley Turner would be at two schools simultaneously, which is impossible).
- **Risk**: double-count meals for the same student-day; or under-count absences if the absence applies to one session but not the other.
- **Status**: decided — see `docs/DECISIONS.md` D-05.
- **Decision**: `session_enrolment` is a many-to-many join table. Riley Turner (MBBC) and Riley Turner (ISHS-Tuesday) are confirmed two different people (different parents, schools, email domains) — no real conflict. Validation flags any single student UUID appearing in >1 session on the same date for operator review.

## E-15 — `"Opted out of Catering"` is an attendance flag, not a diet

- **Where**: `students.xlsx.Dietary`. 7 rows contain `"Opted out of Catering"` (6 alone, 1 combined with allergy info).
- **Observation**: This value excludes the student from meal counts entirely. It is structurally different from `Halal` or `Nut Free`.
- **Risk**: if treated as a normal dietary restriction, the student is counted in the meal total and gets an unwanted meal.
- **Status**: decided — see `docs/DECISIONS.md` D-06.
- **Decision**: `opted_out` boolean lives on the `students` table, not `session_enrolment`. Dietary restrictions are stored separately and always, even for opted-out students. Changes require a manual operator override with reason and timestamp.

## E-16 — `Building` only, no room number

- **Where**: `sessions.xlsx.Building`.
- **Observation**: Delivery destination is a building name only (`Library`, `X Block`, `Ella Building`). No room number.
- **Risk**: caterer arrives at the building and can't find the session.
- **Status**: open.
- **Proposed stance**: include the manager's mobile in every order email so the driver can call. Surface a "missing room number" warning at preflight.

## E-17 — Meaning of "menu item count"

- **Where**: `caterers.xlsx` column headers `minimum order quantity for {4,5,6} menu items`.
- **Observation**: Implied that the operator chooses to offer 4, 5, or 6 dishes from the caterer's 10-item menu that week, and the minimum scales with that choice.
- **Risk**: ambiguity about whether "menu items" means *distinct options ordered* or *number of menu choices offered to students*.
- **Status**: decided — see `docs/DECISIONS.md` D-07.
- **Decision**: "menu items" = number of distinct orderable options on the offered menu for that week, chosen by the operator. Pending stakeholder confirmation. Customisable parent dishes are split into variants per D-09.

## E-18 — Delivery scope ambiguous

- **Where**: `caterer-menus.pdf` heading lines.
- **Observation**: Terrific is `$30 per school per trip`. Kenko is `$10 per school per trip`. Guzman is `$50 per trip` — missing the "per school" qualifier.
- **Risk**: cost calculation undercount / overcount when a caterer serves multiple schools on one day.
- **Status**: open.
- **Proposed stance**: treat Guzman's "per trip" as "per delivery run" (charged once even across multiple schools on the same day) unless clarified. Validate the assumption with the stakeholder.

## E-19 — Halal is inferred, not tagged

- **Where**: `caterer-menus.pdf` page 1 ("Assume all non-pork meals are halal").
- **Observation**: The system must derive a per-dish `is_halal` from the dish name / ingredients.
- **Risk**: misclassifying a dish (e.g. dishes containing alcohol or non-halal-slaughtered meat would not be halal even without pork).
- **Status**: decided — see `docs/DECISIONS.md` D-08.
- **Decision**: apply the source rule literally (`no pork` → halal) through deterministic inference, with pork indicators such as pork and bacon marking a dish as not halal. Future operator-reviewed ingredient flags should supersede name-keyword guesses for production matching.

## E-20 — Same dish name, different flags across caterers

- **Where**: `caterer-menus.pdf`.
- **Observation**:
  - `Sweet and Sour Chicken`: Lakehouse → [GF DF NF], Kenko → [GF DF].
  - `Chinese Honey Soy Noodles`: Terrific → [DF], Kenko → [DF].
- **Risk**: deduplicating dishes across caterers would lose attribute distinctions. Recipes genuinely differ.
- **Status**: open.
- **Proposed stance**: keep `dish` rows scoped to caterer; never merge by dish name.

## E-21 — School name punctuation drift

- **Where**: `Moreton Bay Boys' College` appears as:
  - `Moreton Bay Boys' College` in `sessions.xlsx`, `students.xlsx`, `absences.pdf`
  - `Moreton Bay Boys College` (no apostrophe) in `caterer-contacts.pdf`
- **Risk**: any string-equality join across files mis-joins.
- **Status**: open.
- **Proposed stance**: maintain a canonical school name + an alias list. All ingestion passes go through a normaliser.

## E-22 — Absence scope is assumed, not stated

- **Where**: `absences.pdf`.
- **Observation**: Each entry is a student + school + date. No mention of whether the absence is the whole school day or just the tutoring session, no reason, no AM/PM split.
- **Risk**: low — there is one meal per session, so any absence on the date means "no meal needed". But if a school later has two sessions on one date, the assumption breaks.
- **Status**: open.
- **Proposed stance**: treat each absence row as "missing from the unique tutoring session at that school on that date" and fail-loud if more than one session matches.

## E-23 — `day` and `date` columns disagree with the Gregorian calendar

- **Where**: `sessions.xlsx`. Surfaced during ingestion.
- **Observation**: The previous inventory claim ("`day` is always `date.strftime('%A')`") is incorrect. The source labels `2026-05-02` as Tuesday, but in the real Gregorian calendar that date is a Saturday. The dates and day labels are internally consistent under the operational assumption that May 1 = Monday → May 4 = Thursday, but they do not match real-world weekdays. Likely this dataset has dates transposed from a 2023 week (when 2023-05-01 was a Monday).
- **Risk**: a Python-derived `date.strftime('%A')` would mislabel every session. `students.xlsx` sheets use the source day labels (e.g. `"JPC - Tuesday"`), so any matching by computed weekday silently fails.
- **Status**: open.
- **Proposed stance**: treat the **source `day` column as authoritative** for day-of-week semantics during ingestion (used to map sheets → sessions). The schema does not need to store it (D-03 holds), but the ingestion pipeline must read it from the parsed source rather than deriving it from `session_date`. Document the assumption that the operational week is Mon→Thu regardless of the underlying calendar.

## E-24 — Customisable dishes cannot be represented by one safety flag set

- **Where**: `caterer-menus.pdf`; discussed while reviewing untagged/customisable dishes such as `Cali Burrito`.
- **Observation**: Some caterer menu items are customisable. A `Cali Burrito` might be beef, chicken, vegetarian, or another confirmed option depending on what is ordered.
- **Risk**: Marking the generic parent dish as vegetarian-safe or meat-containing is both overbroad and under-specific. Restricted students could be allocated a vague parent item whose actual preparation violates their requirements, or safe variants could be unnecessarily blocked.
- **Status**: decided — see `docs/DECISIONS.md` D-09.
- **Decision**: keep the source `dishes` row as the parent menu item and create concrete `dish_variants` for orderable options. Menu offers and generated orders operate on variants, each with its own reviewed dietary and ingredient flags.
