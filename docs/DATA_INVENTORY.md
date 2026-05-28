# Data Inventory — Raw Source Files

This document catalogues every file under `data/raw/`. It is the first artefact produced before schema design, ingestion code, or validation rules. It is descriptive only — it does **not** prescribe a schema or attempt to reconcile the inconsistencies it surfaces. Open questions are referenced by id and tracked in [EDGE_CASES.md](EDGE_CASES.md).

Files inspected directly: structures, headers, row counts, and sample values below were read from the raw files, not inferred.

## 1. Overview

- **Operational week**: 2026-05-01 (Mon) → 2026-05-04 (Thu). 4 weekdays, no Friday session present.
- **Schools (5)**: Moreton Bay Boys' College (MBBC), John Paul College (JPC), MacGregor State High School (MSHS), Indooroopilly State High School (ISHS), Loreto College (LC), Cannon Hill Anglican College (CHAC). Six names, but MSHS appears only in sessions / contacts overlap, so the student roster covers 5 schools and 11 distinct school-day sessions.
- **Caterers (4)**: Lakehouse Victoria Point, Terrific Noodles, Kenko Sushi House, Guzman y Gomez.
- **Sessions (11)**: tabulated in `sessions.xlsx`.
- **Student-session rows**: 320 across 11 sheets in `students.xlsx`. **307 unique student names** — 13 students appear in two sheets (see [E-14](EDGE_CASES.md#e-14-students-attending-multiple-sessions)).
- **Menus**: 4 caterers × 10 dishes = 40 dish rows.
- **Absences**: 10 individual student-session absences across 6 school/date groups.
- **Exclusions**: 3 named cancellation events (one is year-level partial).

## 2. File-by-file inventory

### 2.1 `data/raw/students.xlsx`

- **Logical entity**: Student-session enrolment + dietary preference + parent contact.
- **Workbook structure**: 11 worksheets, one per school-day session. Sheet name encodes school code and day-of-week (e.g. `JPC - Tuesday`, `MBBC`, `CHAC - Wednesday`). MBBC and MSHS sheets omit the day suffix because each school has a single session that week.
- **Per-sheet layout**: Row 1 = merged title cell containing the full session label (e.g. `"Moreton Bay Boys' College - Tuesday"`). Row 2 blank. Row 3 = column headers. Row 4+ = student rows.
- **Column headers (exact)**: `Student`, `Year Level`, `Subjects`, `Dietary`, `Student Email`, `Parent`, `Parent Email`, `Parent Mobile`.
- **Per-column types**:
  - `Student` — str. Full name. e.g. `Henry Hill`, `Zachary Anderson`.
  - `Year Level` — int. Values present: 9, 10, 11, 12.
  - `Subjects` — str, free-text comma-separated list. e.g. `"Physics, Mathematical Methods, Legal Studies, English, Physical Education"`. Not normalised.
  - `Dietary` — str | None. Mostly None (261 / 320 ≈ 81.6%; see [E-12](EDGE_CASES.md#e-12--empty-dietary-cell--meaning)). 19 distinct populated values, mixing allergy, religion, preference, and opt-out categories (see breakdown below).
  - `Student Email` — str, email format. e.g. `henryhill@mbbc.qld.edu.au`, `noahbaker@outlook.com`. Mixed school and personal domains.
  - `Parent` — str, full name.
  - `Parent Email` — str, email format.
  - `Parent Mobile` — str, Australian mobile, space-formatted. e.g. `0478 813 748`.
- **Sheet counts** (students per sheet):

  | Sheet | Title row | Students |
  |---|---|---|
  | MBBC | Moreton Bay Boys' College - Tuesday | 17 |
  | JPC - Tuesday | John Paul College - Tuesday | 28 |
  | JPC - Wednesday | John Paul College - Wednesday | 36 |
  | MSHS | MacGregor State High School - Thursday | 8 |
  | ISHS - Monday | Indooroopilly State High School - Monday | 36 |
  | ISHS - Tuesday | Indooroopilly State High School - Tuesday | 45 |
  | ISHS - Thursday | Indooroopilly State High School - Thursday | 39 |
  | LC - Monday | Loreto College - Monday | 35 |
  | LC - Tuesday | Loreto College - Tuesday | 21 |
  | CHAC - Monday | Cannon Hill Anglican College - Monday | 16 |
  | CHAC - Wednesday | Cannon Hill Anglican College - Wednesday | 39 |
  | **Total** |  | **320** |

- **Year-level distribution (across all rows)**: Yr 9 = 33, Yr 10 = 69, Yr 11 = 90, Yr 12 = 128.
- **Dietary value distribution** (raw strings, exactly as stored):

  | Count | Value |
  |---|---|
  | 261 | *(empty / None)* |
  | 16 | Halal |
  | 8 | No Beef |
  | 8 | Vegetarian |
  | 6 | Nut Free |
  | 6 | Opted out of Catering |
  | 2 | No Beef, No Pork |
  | 2 | Gluten Free, Dairy Free |
  | 1 each | No Fish; No Shellfish; Halal, Vegetarian; No Red Meat; No Seafood; Nut Free, No Shellfish, Opted out of Catering; No Pork; No Pork, No Shellfish; Dairy Free; Gluten Free; Nut Free, No Seafood |

  Notable: `Dietary` mixes three orthogonal concepts — allergen exclusion (Nut Free, No Shellfish), religious / preference (Halal, Vegetarian, No Pork), and catering opt-out (Opted out of Catering). The string `"Opted out of Catering"` excludes a student from meal counts entirely; it is not a dietary restriction in the menu-filter sense. See [E-15](EDGE_CASES.md#e-15-opted-out-of-catering-is-an-attendance-flag-not-a-diet).
- **Structural quirks**:
  - Merged title row in row 1 + blank row 2 means a naïve `pd.read_excel` reads the title as the first column header. Parser must skip the first two rows.
  - School + day live in the sheet name, not in any column. Must be lifted into the row during parsing.
  - 13 students appear in two different sheets — see [E-14](EDGE_CASES.md#e-14-students-attending-multiple-sessions).
  - No student id. Joins to other files are by full-name match (fragile — [E-01](EDGE_CASES.md#e-01-no-student-ids-name-only-join)).

### 2.2 `data/raw/sessions.xlsx`

- **Logical entity**: Per school-day tutoring session and its assigned caterer / manager / time / building.
- **Workbook structure**: Single sheet `sessions`. 1 header row + 11 data rows.
- **Column headers (exact, case- and hyphen-preserving)**: `school`, `region`, `caterer`, `date`, `day`, `manager`, `manager-mobile`, `start-time`, `end-time`, `dinner-time`, `year-levels`, `Building`.
- **Per-column types**:
  - `school` — str. 5 distinct schools.
  - `region` — str. Redlands, South Brisbane, West Brisbane, Central Brisbane.
  - `caterer` — str. Matches one of the 4 caterers in `caterers.xlsx` exactly.
  - `date` — `datetime.datetime` (midnight). 4 distinct dates spanning 2026-05-01..04.
  - `day` — str. Redundant with `date` (see [E-11](EDGE_CASES.md#e-11-day-redundant-with-date)).
  - `manager` — str, first name only. 9 distinct values, 2 reused across sessions (see [E-07](EDGE_CASES.md#e-07-repeated-manager-first-names)).
  - `manager-mobile` — str, space-formatted Australian mobile.
  - `start-time`, `end-time`, `dinner-time` — str. Lower-case am/pm, e.g. `"4:00pm"`, `"7:00pm"`, `"5:30pm"`. Not stored as TIME (see [E-10](EDGE_CASES.md#e-10-times-as-strings)).
  - `year-levels` — str, comma-space-separated. Values seen: `"12, 11"`, `"12, 11, 10, 9"`, `"12, 11, 10"`. Order is descending. Year 9 is **not** served at LC or CHAC; only MBBC's Tuesday limits to Years 11–12.
  - `Building` — str. e.g. `Library`, `G Centre`, `X Block`, `Ella Building`, `E Centre`. No room number ([E-16](EDGE_CASES.md#e-16-building-only-no-room)).
- **All 11 rows** (for reference; full text in file):

  | # | school | date | day | caterer | manager | year-levels | Building |
  |---|---|---|---|---|---|---|---|
  | 1 | Moreton Bay Boys' College | 2026-05-02 | Tuesday | Lakehouse Victoria Point | Triet | 12, 11 | Library |
  | 2 | John Paul College | 2026-05-02 | Tuesday | Terrific Noodles | Jessie | 12, 11, 10, 9 | G Centre |
  | 3 | John Paul College | 2026-05-03 | Wednesday | Terrific Noodles | Liam | 12, 11, 10, 9 | G Centre |
  | 4 | MacGregor State High School | 2026-05-04 | Thursday | Terrific Noodles | Jessie | 12, 11, 10, 9 | Library |
  | 5 | Indooroopilly State High School | 2026-05-01 | Monday | Kenko Sushi House | Lucian | 12, 11, 10, 9 | X Block |
  | 6 | Indooroopilly State High School | 2026-05-02 | Tuesday | Kenko Sushi House | Lucian | 12, 11, 10, 9 | X Block |
  | 7 | Indooroopilly State High School | 2026-05-04 | Thursday | Kenko Sushi House | Ethan | 12, 11, 10, 9 | X Block |
  | 8 | Loreto College | 2026-05-01 | Monday | Guzman y Gomez | Claire | 12, 11, 10 | Ella Building |
  | 9 | Loreto College | 2026-05-02 | Tuesday | Guzman y Gomez | Claire | 12, 11, 10 | Ella Building |
  | 10 | Cannon Hill Anglican College | 2026-05-01 | Monday | Guzman y Gomez | Ethan | 12, 11, 10 | E Centre |
  | 11 | Cannon Hill Anglican College | 2026-05-03 | Wednesday | Guzman y Gomez | Camilo | 12, 11, 10 | E Centre |

- **Structural quirks**:
  - 2 of the 11 sessions overlap with exclusions (rows 7 and 9 fully cancelled; row 11 partially cancelled — see exclusions.pdf).
  - **Correction (see [E-23](EDGE_CASES.md#e-23--day-and-date-columns-disagree-with-the-gregorian-calendar))**: the earlier claim that `day` matches `date.strftime('%A')` on every row is **wrong**. `2026-05-02` is labelled `Tuesday` in the source but is actually a Saturday in the Gregorian calendar. The `day` column is internally consistent with the operational week (May 1 = Monday → May 4 = Thursday), but it cannot be derived from `date`. Ingestion must treat the source `day` column as authoritative for sheet→session matching.

### 2.3 `data/raw/caterers.xlsx`

- **Logical entity**: Caterer weekly minimum-order schedule.
- **Workbook structure**: Single sheet `caterers`. 1 header + 4 caterer rows + 1 blank row + 1 footer-note row.
- **Column headers (exact)**: `caterer`, `region`, `minimum order quantity for 4 menu items`, `minimum order quantity for 5 menu items`, `minimum order quantity for 6 menu items`.
- **All rows**:

  | caterer | region | min @ 4 items | min @ 5 items | min @ 6 items |
  |---|---|---|---|---|
  | Lakehouse Victoria Point | Redlands | 15 | 20 | 25 |
  | Terrific Noodles | South Brisbane | 10 | 20 | 30 |
  | Kenko Sushi House | West Brisbane | 35 | 40 | 45 |
  | Guzman y Gomez | Central Brisbane | 20 | 25 | 30 |

- **Footer note (row 7, column A)**: `"*order quantity means total number of ordered meals for the week across all schools"` — defines the unit of the minimum as weekly meals aggregated across schools, not per session. See [E-04](EDGE_CASES.md#e-04-caterer-weekly-minimum-vs-realised-demand).
- **Structural quirks**: The three minimum columns are not normalised — they imply a `(caterer, menu_item_count, min_meals)` shape that may want flattening during ingestion. The "menu item count" is now interpreted as the number of distinct orderable options the operator chooses to offer that week. See [E-17](EDGE_CASES.md#e-17-meaning-of-menu-item-count) and [D-09](DECISIONS.md#d-09---customisable-dishes-are-split-into-orderable-variants-e-24).

### 2.4 `data/raw/caterer-menus.pdf`

- **Logical entity**: Per-caterer menu of dishes + dietary attribute flags + pricing.
- **Structure**: 5 pages. Page 1 is a dietary legend; pages 2–5 are one caterer each. Each caterer page has a heading line (name + pricing + delivery) followed by 10 dish lines (name on left, space-separated attribute flags on right).
- **Dietary legend (page 1, verbatim)**: `GF = Gluten Free`, `DF = Dairy Free`, `NF = Nut Free`, `VO = Vegetarian Option`, plus the rule `"Assume all non-pork meals are halal."`
- **Pricing summary**:

  | Caterer | Per-item price | GST | Delivery |
  |---|---|---|---|
  | Lakehouse Victoria Point | $35 | excluding | $0 |
  | Terrific Noodles | $20.50 | excluding | $30 per school per trip |
  | Kenko Sushi House | $5.50 | including | $10 per school per trip |
  | Guzman y Gomez | $15 | including | $50 per trip |

  GST inclusivity is inconsistent ([E-08](EDGE_CASES.md#e-08-gst-inclusivity-varies)). Delivery scope wording also varies ("per school per trip" vs "per trip") — Guzman's "per trip" is ambiguous about whether multi-school stops cost once or N times ([E-18](EDGE_CASES.md#e-18-delivery-scope-ambiguous)).
- **Dishes (40 total) and their flags** — recorded verbatim, including dishes that have **no** flags:

  Lakehouse Victoria Point: Shrimp Fried Rice [GF DF]; Spaghetti Bolognese + Garlic Bread [NF]; Sweet and Sour Chicken [GF DF NF]; Classic Cream Pasta [NF]; Gnocchi in Tomato Sauce [NF]; Chicken, Bacon, Avo Wrap [VO]; Fried Chicken Burger + Chips [NF]; Fish Taco Bowl [NF]; Korean Beef Bulgogi Rice Bowl [GF DF NF]; Japanese Chicken Curry [DF NF VO].

  Terrific Noodles: Spicy Miso Udon [DF]; Stir-fry Noodles topped with Chicken [GF DF NF]; Grilled Pork Vermicelli Salad [GF DF NF VO]; Spaghetti meatballs [NF]; Lemongrass Grilled Beef and Noodles [GF DF NF VO]; Creamy Garlic Beef Noodles [VO]; Mie Goreng [GF DF NF VO]; **Beef Pad Thai []**; **Bacon Carbonara []**; Chinese Honey Soy Noodles [DF].

  Kenko Sushi House: Lamb wrap [NF]; Chicken Parmi, chips and salad [DF NF]; Japanese Chicken Katsu [NF VO]; Teriyaki Salmon rice bowl [GF DF NF VO]; Chicken Karaage ricebowl [DF NF VO]; **Creamy Udon []**; Beef Fried Rice [GF DF VO]; **Mongolian Beef and Rice []**; Sweet and Sour Chicken [GF DF]; Chinese Honey Soy Noodles [DF].

  Guzman y Gomez: Breakfast Tacos [NF VO]; Caesar Salad [GF DF NF VO]; **Cali Burrito []**; **Grilled Chicken Burrito []**; Pulled pork burrito bowl [GF NF VO]; Nachos [GF VO]; Nacho Fries [GF VO]; **Chicken Quesadilla []**; Chicken Enchilada [GF DF]; **Crispy Chicken Taco []**.

  **8 of 40 dishes carry no dietary tag at all** ([E-13](EDGE_CASES.md#e-13-dishes-with-no-dietary-tag)). Casing of dish names is inconsistent ("ricebowl" vs "rice bowl"; "meatballs" lower-case vs Title-case).
- **Implicit rule**: "Assume all non-pork meals are halal" means halal is **inferred** per-dish from ingredient text. Pork-containing dishes in the menu: Grilled Pork Vermicelli Salad, Bacon Carbonara, Pulled pork burrito bowl, and the bacon items (Chicken, Bacon, Avo Wrap; Bacon Carbonara). See [E-19](EDGE_CASES.md#e-19-halal-is-inferred-not-tagged).
- **Cross-menu duplicates**: `Sweet and Sour Chicken` and `Chinese Honey Soy Noodles` appear in both Lakehouse / Kenko, and Kenko respectively, but with different attribute flags between caterers ([E-20](EDGE_CASES.md#e-20-same-dish-name-different-flags-across-caterers)).

### 2.5 `data/raw/caterer-contacts.pdf`

- **Logical entity**: Caterer-side contacts (primary + optional secondary) and the schools each caterer currently serves vs. is able to serve.
- **Structure**: 1 page, 4 named blocks (one per caterer), in the same order as the menus PDF.
- **Block fields** (free-text, not tabular):
  - Caterer name (heading)
  - Primary contact: full name + parenthetical role note (e.g. `"(main point of contact for orders)"`)
  - Primary email
  - Optional secondary contact + role note (e.g. `"(chef – does not want to be cc'ed)"`, `"(chef – wants to be cc'ed)"`)
  - Optional secondary email
  - `Serves: <comma-separated schools>`
  - `Able to serve: <comma-separated schools>`
- **Captured data**:

  | Caterer | Primary | Primary email | Secondary | Secondary email | CC pref |
  |---|---|---|---|---|---|
  | Lakehouse Victoria Point | Carmen Gabrielle | carmen@padea.com.au | — | — | — |
  | Terrific Noodles | Dylan Chern | cherndylan@gmail.com | James Chern (chef) | dylanchern808@gmail.com | does not want to be cc'ed |
  | Kenko Sushi House | Big Mom (also chef) | hellopadea@gmail.com | — | — | — |
  | Guzman y Gomez | Big Chicken | carmengabrielleee@gmail.com | Medium Giraffe (chef) | dylan@padea.com.au | wants to be cc'ed |

  | Caterer | Serves | Able to serve |
  |---|---|---|
  | Lakehouse Victoria Point | Moreton Bay Boys College | Moreton Bay Boys College, Cannon Hill Anglican College |
  | Terrific Noodles | John Paul College, MacGregor State High School | John Paul College, MacGregor State High School, Loreto College |
  | Kenko Sushi House | Indooroopilly State High School | Indooroopilly State High School |
  | Guzman y Gomez | Loreto College, Cannon Hill Anglican College | Loreto College, Cannon Hill Anglican College, MacGregor State High School |

- **Oddities**:
  - **School name punctuation inconsistency**: this PDF spells the school as `Moreton Bay Boys College` (no apostrophe), while `sessions.xlsx` and `students.xlsx` use `Moreton Bay Boys' College` (with apostrophe). See [E-21](EDGE_CASES.md#e-21-school-name-punctuation-drift).
  - **Padea-domain emails listed as caterer contacts**: `carmen@padea.com.au` (Lakehouse primary) and `dylan@padea.com.au` (GyG chef) are on Padea's own domain, not the caterer's. Combined with `carmengabrielleee@gmail.com` (GyG primary, deliberately mimicking the Lakehouse contact's name) this strongly suggests the contacts file is either intentionally adversarial or reflects messy real-world routing where Padea staff act as proxies. See [E-09](EDGE_CASES.md#e-09-pseudonymous-suspicious-caterer-emails).
  - **Pseudonymous names**: "Big Mom", "Big Chicken", "Medium Giraffe" are clearly not real names.
  - The CC preference is encoded only in the role parenthetical — not a structured field.
  - "Serves" is always a subset of "Able to serve" (sanity-checked).

### 2.6 `data/raw/exclusions.pdf`

- **Logical entity**: Named per-session cancellation events overriding the sessions table.
- **Structure**: 1 page, 3 narrative paragraphs, each headed `Exclusion One/Two/Three`.
- **Verbatim content**:

  | Id | School | Date | Year levels affected | Reason |
  |---|---|---|---|---|
  | Exclusion One | Indooroopilly State High School | 2026-05-04 | All | Open Day |
  | Exclusion Two | Loreto College | 2026-05-02 | All | Parent Teacher Interviews |
  | Exclusion Three | Cannon Hill Anglican College | 2026-05-03 | Years 12 and 10 only (Year 11 still attends) | School Camp |

- **Oddities**:
  - Format is narrative English, not tabular — parser must extract school, date, year-levels, reason from prose.
  - Dates are written `"4th of May"`, `"2nd of May"`, `"3rd of May"` — ordinal English, must be resolved to ISO dates given the operational week context.
  - Exclusion Three's wording reverses framing: it lists the **cancelled** years (12 and 10) and then states the **attending** year (11) as a separate sentence. The parser must not interpret the second sentence as an additional cancellation. See [E-03](EDGE_CASES.md#e-03-partial-year-level-cancellation).
  - No structured id, no "effective from" or recurrence rules — each exclusion is a single (school, date, year-levels) tuple.

### 2.7 `data/raw/absences.pdf`

- **Logical entity**: Per-student per-session absence flags.
- **Structure**: 1 page, 6 sections. Each section header is `<School name> - <DD/MM/YYYY> Absences`, followed by 1 or more student names, one per line.
- **Verbatim content**:

  | School | Date | Absent students |
  |---|---|---|
  | Moreton Bay Boys' College | 2026-05-02 | Noah Baker |
  | John Paul College | 2026-05-02 | Christina Hu; Nathan Smith |
  | MacGregor State High School | 2026-05-04 | Rose Smith |
  | Indooroopilly State High School | 2026-05-02 | Charlie Morris; Jack Carter; Charlie Mitchell |
  | Loreto College | 2026-05-01 | Holly Hill; Imogen Evans |
  | Cannon Hill Anglican College | 2026-05-03 | Henry Cook |

  **10 absence records** total.
- **Oddities**:
  - Student references are full-name only; same matching fragility as everywhere else ([E-01](EDGE_CASES.md#e-01-no-student-ids-name-only-join)).
  - Header punctuation matches `students.xlsx` (`Moreton Bay Boys'`) but **not** `caterer-contacts.pdf` (`Moreton Bay Boys`) — same school name in three different shapes across the source pack ([E-21](EDGE_CASES.md#e-21-school-name-punctuation-drift)).
  - No reason / no "all day vs partial" distinction — every entry is assumed to mean "missing the one tutoring meal at that school on that date" ([E-22](EDGE_CASES.md#e-22-absence-scope-assumed-single-session)).
  - `Henry Cook` at CHAC on 2026-05-03 overlaps with Exclusion Three (Years 12 and 10 cancelled). If Henry Cook is in Year 12 or 10, the absence is moot; if in Year 11, the absence still matters. Resolution requires the schema to join absences against the post-exclusion attendee set.

## 3. Cross-file reference map

```
sessions.xlsx
  ├── school + day  ───►  students.xlsx sheet name (with name variants — E-21)
  ├── caterer       ───►  caterers.xlsx.caterer
  │                  ───►  caterer-menus.pdf block heading
  │                  ───►  caterer-contacts.pdf block heading
  ├── year-levels   ───►  filters students.xlsx rows by `Year Level` (after exclusion overrides)
  └── date + school ──┐
                      ├── exclusions.pdf  (school + date → year-level cancellation override)
                      └── absences.pdf    (school + date + student name → attendance flag)

students.xlsx.Student  ───►  absences.pdf student names (exact match required — E-01)
students.xlsx.Dietary  ───►  caterer-menus.pdf dish flags (free-text → structured — E-05)

caterer-contacts.pdf
  ├── Serves        ───►  consistency check against sessions.xlsx.caterer assignments
  └── Able to serve ───►  fallback candidates (currently informational only — E-06)
```

There are **no shared identifiers** across files. Every join is by string (name, school name, date) and is therefore exposed to typo / casing / punctuation drift. Treat every join as a place that needs a normalisation rule.

## 4. Primary key candidates (working assumptions)

These are working candidates for the eventual schema, not commitments. They will be revisited during schema design.

| Entity | Candidate PK | Notes |
|---|---|---|
| Caterer | `caterer` (name) | 4 distinct, unique across all files. Stable enough; would still recommend an internal surrogate id. |
| School | `school` (name) | 5–6 distinct. Suffers from punctuation drift ([E-21](EDGE_CASES.md#e-21-school-name-punctuation-drift)); needs a canonical form. |
| Session | (`school`, `date`) | 11 distinct in sessions.xlsx. Composite. `day` is derivable. |
| Student | (`Student`, `school`)? | No id; same-name students are real (`Charlie Morris` ≠ `Charlie Mitchell`). Probably need (`Student Email`) as a tiebreaker, but absences.pdf has no email — so the canonical join with absences can only be (`Student`, `school`). |
| Session-student enrolment | (`Student`, `school`, `day`) | Allows the 13 multi-session students to enrol in more than one session. |
| Dish | (`caterer`, `dish name`) | 40 rows; same dish name appears across caterers ([E-20](EDGE_CASES.md#e-20-same-dish-name-different-flags-across-caterers)). |
| Absence | (`Student`, `school`, `date`) | 10 records. |
| Exclusion | (`school`, `date`, optional year-levels list) | 3 records. |

## 5. What this inventory deliberately does **not** do

- Propose a Supabase schema.
- Resolve any of the E-NN edge cases.
- Implement any parser.
- Alter any file in `data/raw/`.

The next step is to decide, edge case by edge case in [EDGE_CASES.md](EDGE_CASES.md), what the system's behaviour should be — then design the schema to reflect those decisions.
