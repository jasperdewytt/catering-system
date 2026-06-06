"""Ingestion pipeline: read raw files via parsers and write to Supabase.

The pipeline is idempotent — re-running it upserts rather than duplicates.
FK direction dictates order: schools → caterers → sessions → exclusions →
students → enrolments → dishes → absences.

D-01 fail-loud rules:
  * unrecognised dietary text → row inserted into student_dietary_warnings
  * absence that resolves to 0 or >1 students → IngestionError raised

Provenance: every ingested-data row carries `source_file` and `source_row`
columns where the schema allows it.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Any

from supabase import Client

from .normalisation import SCHOOL_ALIASES, SCHOOL_CANONICAL
from .parsers import (
    ParsedStudentRow,
    parse_absences_pdf,
    parse_caterer_contacts_pdf,
    parse_caterer_menus_pdf,
    parse_caterers_xlsx,
    parse_exclusions_pdf,
    parse_sessions_xlsx,
    parse_students_xlsx,
)


class IngestionError(RuntimeError):
    """Raised when the pipeline encounters data it cannot safely resolve."""


@dataclass
class IngestionReport:
    schools: int = 0
    school_aliases: int = 0
    caterers: int = 0
    caterer_weekly_minimums: int = 0
    caterer_contacts: int = 0
    sessions: int = 0
    exclusions: int = 0
    students: int = 0
    student_dietary_tags: int = 0
    student_dietary_warnings: int = 0
    session_enrolments: int = 0
    dishes: int = 0
    absences: int = 0
    soft_duplicate_warnings: list[str] = None  # (school, full_name) duplicates
    multi_session_same_date: list[str] = None  # student × date conflicts (D-05)

    def __post_init__(self) -> None:
        if self.soft_duplicate_warnings is None:
            self.soft_duplicate_warnings = []
        if self.multi_session_same_date is None:
            self.multi_session_same_date = []


# --- Small helpers ---------------------------------------------------------


def _provenance(source_file: str, row_obj: Any) -> dict[str, Any]:
    """Build `source_file` + `source_row` jsonb columns from a dataclass."""
    if hasattr(row_obj, "__dataclass_fields__"):
        row_dict = asdict(row_obj)
    else:
        row_dict = dict(row_obj)

    # Make jsonb-safe (dates, sets).
    def _coerce(v: Any) -> Any:
        if isinstance(v, (date,)):
            return v.isoformat()
        if isinstance(v, set):
            return sorted(v)
        if isinstance(v, dict):
            return {k: _coerce(x) for k, x in v.items()}
        if isinstance(v, list):
            return [_coerce(x) for x in v]
        if hasattr(v, "__dataclass_fields__"):
            return _coerce(asdict(v))
        return v

    return {"source_file": source_file, "source_row": _coerce(row_dict)}


def _select_all(client: Client, table: str, columns: str = "*") -> list[dict[str, Any]]:
    return client.table(table).select(columns).execute().data


# --- Phase 1: schools, caterers, contacts ---------------------------------


def ingest_schools_and_caterers(
    client: Client,
    raw_dir: Path,
    report: IngestionReport,
) -> tuple[dict[str, str], dict[str, str]]:
    """Insert schools, school_aliases, caterers, caterer_weekly_minimums,
    caterer_contacts. Returns (school_id_by_canonical_name, caterer_id_by_name).
    """
    sessions = parse_sessions_xlsx(raw_dir / "sessions.xlsx")
    caterers = parse_caterers_xlsx(raw_dir / "caterers.xlsx")
    menus = parse_caterer_menus_pdf(raw_dir / "caterer-menus.pdf")
    contact_blocks = parse_caterer_contacts_pdf(raw_dir / "caterer-contacts.pdf")

    # Schools are derived from sessions.xlsx (the canonical naming source).
    # Build a {canonical_name: short_code} map by joining with SCHOOL_CANONICAL.
    canonical_to_short = {v: k for k, v in SCHOOL_CANONICAL.items()}
    seen_schools: dict[str, str | None] = {}  # canonical_name → region
    for s in sessions:
        if s.school_name not in canonical_to_short:
            raise IngestionError(
                f"sessions.xlsx references school {s.school_name!r} which is not "
                f"in SCHOOL_CANONICAL. Add it to normalisation.py if it is new."
            )
        seen_schools.setdefault(s.school_name, s.region)

    school_rows = [
        {
            "canonical_name": name,
            "short_code": canonical_to_short[name],
            "region": region,
        }
        for name, region in seen_schools.items()
    ]
    client.table("schools").upsert(school_rows, on_conflict="canonical_name").execute()
    school_id_by_name = {
        r["canonical_name"]: r["id"] for r in _select_all(client, "schools", "id, canonical_name")
    }
    report.schools = len(school_rows)

    # Aliases (E-21) — declared statically in normalisation.SCHOOL_ALIASES.
    alias_rows = [
        {"school_id": school_id_by_name[canonical], "alias": alias, "source": source}
        for canonical, aliases in SCHOOL_ALIASES.items()
        for (alias, source) in aliases
    ]
    if alias_rows:
        client.table("school_aliases").upsert(alias_rows, on_conflict="alias").execute()
    report.school_aliases = len(alias_rows)

    # Caterers — combine caterers.xlsx (region + minimums) and menus (pricing).
    menu_by_name = {m.caterer_name: m for m in menus}
    caterer_rows: list[dict[str, Any]] = []
    for c in caterers:
        m = menu_by_name.get(c.name)
        if m is None:
            raise IngestionError(
                f"Caterer {c.name!r} in caterers.xlsx has no menu page in "
                f"caterer-menus.pdf — refusing to insert with placeholder pricing."
            )
        caterer_rows.append(
            {
                "name": c.name,
                "region": c.region,
                "per_item_price_cents": m.per_item_price_cents,
                "gst_inclusive": m.gst_inclusive,
                "delivery_fee_cents": m.delivery_fee_cents,
                "delivery_scope": m.delivery_scope,
                "delivery_notes": m.delivery_notes,
            }
        )
    client.table("caterers").upsert(caterer_rows, on_conflict="name").execute()
    caterer_id_by_name = {r["name"]: r["id"] for r in _select_all(client, "caterers", "id, name")}
    report.caterers = len(caterer_rows)

    # Weekly minimums — flatten the 3-wide source layout into N rows.
    min_rows = [
        {
            "caterer_id": caterer_id_by_name[c.name],
            "menu_item_count": k,
            "minimum_meals": v,
        }
        for c in caterers
        for k, v in c.minimums.items()
    ]
    client.table("caterer_weekly_minimums").upsert(
        min_rows, on_conflict="caterer_id,menu_item_count"
    ).execute()
    report.caterer_weekly_minimums = len(min_rows)

    # Contacts. Use a deterministic natural key for idempotence — we drop
    # then re-insert per caterer (small table, simpler than synthesising keys).
    contact_caterer_ids = [
        caterer_id_by_name[b.caterer_name]
        for b in contact_blocks
        if b.caterer_name in caterer_id_by_name
    ]
    if contact_caterer_ids:
        client.table("caterer_contacts").delete().in_("caterer_id", contact_caterer_ids).execute()
    contact_rows: list[dict[str, Any]] = []
    for b in contact_blocks:
        cid = caterer_id_by_name.get(b.caterer_name)
        if cid is None:
            continue
        for c in b.contacts:
            contact_rows.append(
                {
                    "caterer_id": cid,
                    "role": c.role,
                    "display_name": c.display_name,
                    "email": c.email,
                    "cc_preference": c.cc_preference,
                    "role_note": c.role_note,
                    "is_verified": False,
                    **_provenance("caterer-contacts.pdf", c),
                }
            )
    if contact_rows:
        client.table("caterer_contacts").insert(contact_rows).execute()
    report.caterer_contacts = len(contact_rows)

    return school_id_by_name, caterer_id_by_name


# --- Phase 2: sessions + exclusions ---------------------------------------


def ingest_sessions_and_exclusions(
    client: Client,
    raw_dir: Path,
    school_id_by_name: dict[str, str],
    caterer_id_by_name: dict[str, str],
    report: IngestionReport,
) -> dict[tuple[str, date], str]:
    """Insert sessions + exclusions. Returns {(school_name, session_date): session_id}."""
    sessions = parse_sessions_xlsx(raw_dir / "sessions.xlsx")

    session_rows: list[dict[str, Any]] = []
    for s in sessions:
        school_id = school_id_by_name.get(s.school_name)
        caterer_id = caterer_id_by_name.get(s.caterer_name)
        if school_id is None or caterer_id is None:
            raise IngestionError(
                f"Session {s.school_name} {s.session_date}: missing school or caterer FK"
            )
        session_rows.append(
            {
                "school_id": school_id,
                "caterer_id": caterer_id,
                "session_date": s.session_date.isoformat(),
                "start_time": s.start_time.isoformat() if s.start_time else None,
                "end_time": s.end_time.isoformat() if s.end_time else None,
                "dinner_time": s.dinner_time.isoformat() if s.dinner_time else None,
                "start_time_raw": s.start_time_raw,
                "end_time_raw": s.end_time_raw,
                "dinner_time_raw": s.dinner_time_raw,
                "manager_name": s.manager_name,
                "manager_mobile": s.manager_mobile,
                "year_levels": s.year_levels,
                "building": s.building,
            }
        )
    client.table("sessions").upsert(session_rows, on_conflict="school_id,session_date").execute()

    session_id_by_key: dict[tuple[str, date], str] = {}
    session_year_levels: dict[str, list[int]] = {}
    rows = _select_all(client, "sessions", "id, school_id, session_date, year_levels")
    school_name_by_id = {v: k for k, v in school_id_by_name.items()}
    for r in rows:
        key = (school_name_by_id[r["school_id"]], date.fromisoformat(r["session_date"]))
        session_id_by_key[key] = r["id"]
        session_year_levels[r["id"]] = r["year_levels"]
    report.sessions = len(session_rows)

    # Exclusions.
    exclusions = parse_exclusions_pdf(raw_dir / "exclusions.pdf")
    # Build a (raw_school_name → canonical) by checking aliases.
    canonical_lookup = {
        alias: canonical for canonical, lst in SCHOOL_ALIASES.items() for (alias, _) in lst
    }
    excl_rows: list[dict[str, Any]] = []
    for e in exclusions:
        canonical = canonical_lookup.get(e.school_name, e.school_name)
        session_id = session_id_by_key.get((canonical, e.session_date))
        if session_id is None:
            raise IngestionError(
                f"Exclusion references session {canonical} {e.session_date} which "
                f"does not exist. Sessions.xlsx must be ingested first and contain this row."
            )
        # Empty sentinel = full cancellation; expand to the session's year_levels.
        years = e.excluded_year_levels or list(session_year_levels[session_id])
        excl_rows.append(
            {
                "session_id": session_id,
                "excluded_year_levels": years,
                "reason": e.reason or None,
                **_provenance("exclusions.pdf", e),
            }
        )
    client.table("exclusions").upsert(excl_rows, on_conflict="session_id").execute()
    report.exclusions = len(excl_rows)

    return session_id_by_key


# --- Phase 3: students + diets --------------------------------------------


def ingest_students_and_diets(
    client: Client,
    raw_dir: Path,
    school_id_by_name: dict[str, str],
    report: IngestionReport,
) -> dict[tuple[str, str], str]:
    """Insert students, student_dietary_tags, student_dietary_warnings.

    Returns {(short_code, full_name): student_id} for later resolution.
    Note: this map collapses multi-session students into one entry per
    (school, name) — the same student row serves all their enrolments.
    """
    students = parse_students_xlsx(raw_dir / "students.xlsx")
    short_to_canonical = SCHOOL_CANONICAL

    # Deduplicate by (school, full_name) so a multi-session student becomes
    # one row, not two. Soft-duplicate detection happens here too.
    seen: dict[tuple[str, str], ParsedStudentRow] = {}
    soft_dupes: list[tuple[str, str, str]] = []  # (short_code, name, sheet_a, sheet_b)
    for s in students:
        key = (s.short_code, s.full_name)
        if key in seen:
            soft_dupes.append(
                (s.short_code, s.full_name, seen[key].sheet_name + "+" + s.sheet_name, "")
            )
        else:
            seen[key] = s

    student_rows: list[dict[str, Any]] = []
    for (short_code, full_name), s in seen.items():
        canonical = short_to_canonical.get(short_code)
        school_id = school_id_by_name.get(canonical) if canonical else None
        if school_id is None:
            raise IngestionError(
                f"Student {full_name} sheet={s.sheet_name}: "
                f"cannot resolve school short_code {short_code!r}"
            )
        student_rows.append(
            {
                "school_id": school_id,
                "full_name": full_name,
                "year_level": s.year_level,
                "subjects_raw": s.subjects_raw,
                "student_email": s.student_email,
                "parent_name": s.parent_name,
                "parent_email": s.parent_email,
                "parent_mobile": s.parent_mobile,
                "dietary_raw": s.dietary_raw,
                "opted_out": s.parsed_dietary.opted_out,
                **_provenance(
                    "students.xlsx",
                    {
                        "sheet_name": s.sheet_name,
                        "short_code": s.short_code,
                        "full_name": s.full_name,
                        "dietary_raw": s.dietary_raw,
                    },
                ),
            }
        )

    # students has no natural-key unique constraint (D-01 soft). For idempotence
    # we wipe and re-insert per ingest, which keeps row identity stable within
    # a single run but assigns fresh UUIDs across runs.
    client.table("session_enrolments").delete().neq(
        "session_id", "00000000-0000-0000-0000-000000000000"
    ).execute()
    client.table("absences").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    client.table("student_dietary_tags").delete().neq("tag_code", "__never__").execute()
    client.table("student_dietary_warnings").delete().neq(
        "id", "00000000-0000-0000-0000-000000000000"
    ).execute()
    client.table("students").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    inserted = client.table("students").insert(student_rows).execute().data
    report.students = len(inserted)

    # Build the (short_code, full_name) → student_id map.
    student_id_by_key: dict[tuple[str, str], str] = {}
    school_short_by_id = {school_id_by_name[short_to_canonical[c]]: c for c in short_to_canonical}
    for r in inserted:
        short = school_short_by_id[r["school_id"]]
        student_id_by_key[(short, r["full_name"])] = r["id"]

    # Dietary tags + warnings.
    tag_rows: list[dict[str, Any]] = []
    warn_rows: list[dict[str, Any]] = []
    for (short, name), s in seen.items():
        sid = student_id_by_key[(short, name)]
        for code in s.parsed_dietary.tag_codes:
            tag_rows.append({"student_id": sid, "tag_code": code})
        for raw in s.parsed_dietary.unrecognised:
            warn_rows.append({"student_id": sid, "raw_value": raw, "status": "pending"})
    if tag_rows:
        client.table("student_dietary_tags").insert(tag_rows).execute()
    if warn_rows:
        client.table("student_dietary_warnings").insert(warn_rows).execute()
    report.student_dietary_tags = len(tag_rows)
    report.student_dietary_warnings = len(warn_rows)

    # Soft-duplicate warnings.
    for dup in soft_dupes:
        report.soft_duplicate_warnings.append(
            f"Duplicate (school={dup[0]}, full_name={dup[1]}) appears in multiple "
            f"sheets {dup[2]} — operator must confirm two distinct students."
        )

    return student_id_by_key


# --- Phase 4: enrolments --------------------------------------------------


def ingest_session_enrolments(
    client: Client,
    raw_dir: Path,
    school_id_by_name: dict[str, str],
    session_id_by_key: dict[tuple[str, date], str],
    student_id_by_key: dict[tuple[str, str], str],
    report: IngestionReport,
) -> None:
    students = parse_students_xlsx(raw_dir / "students.xlsx")
    parsed_sessions = parse_sessions_xlsx(raw_dir / "sessions.xlsx")
    short_to_canonical = SCHOOL_CANONICAL
    canonical_to_short = {v: k for k, v in short_to_canonical.items()}

    # Build the matching map from the source day_label. The raw fixture dates
    # are corrected from May 1-4 to the intended June 1-4 week in the parser,
    # but the label remains useful for matching students.xlsx sheet suffixes.
    sessions_by_short: dict[str, list[tuple[str, date, str]]] = {}
    for ps in parsed_sessions:
        short = canonical_to_short.get(ps.school_name)
        if short is None:
            continue
        sessions_by_short.setdefault(short, []).append(
            (ps.school_name, ps.session_date, ps.day_label)
        )

    enrol_rows: list[dict[str, Any]] = []
    # Track (student_id, date) conflicts (D-05).
    student_dates: dict[str, set[date]] = {}
    conflicts: list[str] = []

    for s in students:
        short = s.short_code
        candidates = sessions_by_short.get(short, [])
        if s.day_hint:
            from_day = [(sn, d, lbl) for (sn, d, lbl) in candidates if lbl == s.day_hint]
            if not from_day:
                raise IngestionError(
                    f"Student {s.full_name} sheet={s.sheet_name}: no session "
                    f"found for {short} on {s.day_hint}."
                )
            chosen_sn, chosen_d, _ = from_day[0]
        else:
            if len(candidates) != 1:
                raise IngestionError(
                    f"Student {s.full_name} sheet={s.sheet_name}: ambiguous session "
                    f"for {short} (candidates={candidates})."
                )
            chosen_sn, chosen_d, _ = candidates[0]
        chosen = (chosen_sn, chosen_d)
        sid = student_id_by_key[(short, s.full_name)]
        session_id = session_id_by_key[chosen]
        enrol_rows.append({"student_id": sid, "session_id": session_id})

        # D-05 conflict tracking.
        seen_dates = student_dates.setdefault(sid, set())
        if chosen_d in seen_dates:
            conflicts.append(
                f"Student {s.full_name} (id={sid}) enrolled in >1 session on {chosen_d}"
            )
        seen_dates.add(chosen_d)

    if enrol_rows:
        client.table("session_enrolments").insert(enrol_rows).execute()
    report.session_enrolments = len(enrol_rows)
    report.multi_session_same_date.extend(conflicts)


# --- Phase 5: dishes -------------------------------------------------------


def ingest_dishes(
    client: Client,
    raw_dir: Path,
    caterer_id_by_name: dict[str, str],
    report: IngestionReport,
) -> None:
    menus = parse_caterer_menus_pdf(raw_dir / "caterer-menus.pdf")
    dish_rows: list[dict[str, Any]] = []
    for m in menus:
        cid = caterer_id_by_name.get(m.caterer_name)
        if cid is None:
            raise IngestionError(f"Menu references caterer {m.caterer_name!r} that doesn't exist.")
        for d in m.dishes:
            dish_rows.append(
                {
                    "caterer_id": cid,
                    "name": d.name,
                    "name_raw": d.name_raw,
                    "is_gluten_free": "GF" in d.declared_flags,
                    "is_dairy_free": "DF" in d.declared_flags,
                    "is_nut_free": "NF" in d.declared_flags,
                    "is_vegetarian_option": "VO" in d.declared_flags,
                    "is_halal_inferred": d.is_halal_inferred,
                    "halal_inference_note": d.halal_inference_note,
                    "has_no_declared_tags": d.has_no_declared_tags,
                    "contains_beef": d.ingredient_flags.contains_beef,
                    "contains_pork": d.ingredient_flags.contains_pork,
                    "contains_red_meat": d.ingredient_flags.contains_red_meat,
                    "contains_fish": d.ingredient_flags.contains_fish,
                    "contains_shellfish": d.ingredient_flags.contains_shellfish,
                    "ingredient_flags_source": "keyword_inferred",
                    **_provenance("caterer-menus.pdf", d),
                }
            )
    if dish_rows:
        client.table("dishes").upsert(dish_rows, on_conflict="caterer_id,name").execute()
        existing_dishes = {
            (row["caterer_id"], row["name"]): row["id"]
            for row in _select_all(client, "dishes", "id, caterer_id, name")
        }
        existing_default_variants = {
            row["dish_id"]
            for row in _select_all(client, "dish_variants", "dish_id, is_default")
            if row["is_default"]
        }
        default_variant_rows = []
        for row in dish_rows:
            dish_id = existing_dishes[(row["caterer_id"], row["name"])]
            if dish_id in existing_default_variants:
                continue
            default_variant_rows.append(
                {
                    "dish_id": dish_id,
                    "name": "Standard",
                    "is_default": True,
                    "is_available": True,
                    "is_gluten_free": row["is_gluten_free"],
                    "is_dairy_free": row["is_dairy_free"],
                    "is_nut_free": row["is_nut_free"],
                    "is_vegetarian_option": row["is_vegetarian_option"],
                    "is_halal_inferred": row["is_halal_inferred"],
                    "has_no_declared_tags": row["has_no_declared_tags"],
                    "contains_beef": row["contains_beef"],
                    "contains_pork": row["contains_pork"],
                    "contains_red_meat": row["contains_red_meat"],
                    "contains_fish": row["contains_fish"],
                    "contains_shellfish": row["contains_shellfish"],
                    "ingredient_flags_source": "keyword_inferred",
                }
            )
        if default_variant_rows:
            client.table("dish_variants").insert(default_variant_rows).execute()
    report.dishes = len(dish_rows)


# --- Phase 6: absences -----------------------------------------------------


def ingest_absences(
    client: Client,
    raw_dir: Path,
    school_id_by_name: dict[str, str],
    session_id_by_key: dict[tuple[str, date], str],
    student_id_by_key: dict[tuple[str, str], str],
    report: IngestionReport,
) -> None:
    absences = parse_absences_pdf(raw_dir / "absences.pdf")
    short_to_canonical = SCHOOL_CANONICAL
    canonical_to_short = {v: k for k, v in short_to_canonical.items()}
    # absences.pdf uses "Moreton Bay Boys'" (with apostrophe) — same as canonical.
    alias_lookup = {
        alias: canonical for canonical, lst in SCHOOL_ALIASES.items() for (alias, _) in lst
    }

    rows_to_insert: list[dict[str, Any]] = []
    for a in absences:
        canonical = alias_lookup.get(a.school_name, a.school_name)
        if canonical not in canonical_to_short:
            raise IngestionError(
                f"Absence references unknown school {a.school_name!r}. "
                f"Add an alias or canonical entry."
            )
        short = canonical_to_short[canonical]
        sid = student_id_by_key.get((short, a.student_full_name))
        if sid is None:
            raise IngestionError(
                f"Absence: student {a.student_full_name!r} not found at school {canonical} "
                f"({short}). Names must match exactly. D-01 says fail loud."
            )
        session_id = session_id_by_key.get((canonical, a.session_date))
        if session_id is None:
            raise IngestionError(f"Absence: no session for {canonical} on {a.session_date}.")
        rows_to_insert.append(
            {
                "student_id": sid,
                "session_id": session_id,
                **_provenance("absences.pdf", a),
            }
        )
    if rows_to_insert:
        client.table("absences").insert(rows_to_insert).execute()
    report.absences = len(rows_to_insert)


# --- Orchestrator ----------------------------------------------------------


def run_ingestion(client: Client, raw_dir: Path = Path("data/raw")) -> IngestionReport:
    report = IngestionReport()
    school_ids, caterer_ids = ingest_schools_and_caterers(client, raw_dir, report)
    session_ids = ingest_sessions_and_exclusions(client, raw_dir, school_ids, caterer_ids, report)
    student_ids = ingest_students_and_diets(client, raw_dir, school_ids, report)
    ingest_session_enrolments(client, raw_dir, school_ids, session_ids, student_ids, report)
    ingest_dishes(client, raw_dir, caterer_ids, report)
    ingest_absences(client, raw_dir, school_ids, session_ids, student_ids, report)
    return report
