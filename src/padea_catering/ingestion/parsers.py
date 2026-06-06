"""File parsers — pure functions that turn raw source files into Python data.

Nothing here writes to the database. Each parser returns dataclasses that the
pipeline module consumes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, time
from pathlib import Path

import pandas as pd
import pdfplumber

from .normalisation import (
    IngredientFlags,
    ParsedDietary,
    correct_source_operational_date,
    infer_ingredient_flags,
    is_halal,
    parse_dietary,
    parse_ordinal_english_date,
    parse_student_sheet_name,
    parse_time_string,
    parse_year_levels,
)

# Operational week per data inventory.
SOURCE_YEAR = 2026


# --- Caterers (caterers.xlsx) ---------------------------------------------


@dataclass
class ParsedCaterer:
    name: str
    region: str | None
    minimums: dict[int, int]  # {menu_item_count: minimum_meals}


def parse_caterers_xlsx(path: Path) -> list[ParsedCaterer]:
    df = pd.read_excel(path)
    out: list[ParsedCaterer] = []
    for _, row in df.iterrows():
        name = row.get("caterer")
        if not isinstance(name, str) or name.startswith("*"):
            continue  # skip footer notes
        out.append(
            ParsedCaterer(
                name=name.strip(),
                region=str(row["region"]).strip() if pd.notna(row.get("region")) else None,
                minimums={
                    4: int(row["minimum order quantity for 4 menu items"]),
                    5: int(row["minimum order quantity for 5 menu items"]),
                    6: int(row["minimum order quantity for 6 menu items"]),
                },
            )
        )
    return out


# --- Caterer menus (caterer-menus.pdf) ------------------------------------


@dataclass
class ParsedDish:
    name: str
    name_raw: str
    declared_flags: set[str]  # subset of {"GF", "DF", "NF", "VO"}
    has_no_declared_tags: bool
    is_halal_inferred: bool
    halal_inference_note: str | None
    ingredient_flags: IngredientFlags


@dataclass
class ParsedMenu:
    caterer_name: str
    per_item_price_cents: int
    gst_inclusive: bool
    delivery_fee_cents: int
    delivery_scope: str  # 'per_trip' | 'per_school_per_trip' | 'none'
    delivery_notes: str  # verbatim heading text after the price
    dishes: list[ParsedDish]


_MENU_HEADING_RE = re.compile(
    r"^(?P<caterer>.+?)\s+Menu\s*\(\$(?P<price>\d+(?:\.\d+)?)\s+"
    r"(?P<gst>including|excluding)\s+GST\s+per\s+item,\s*(?P<delivery>.+?)\)\s*$",
    re.IGNORECASE,
)
_DECLARED_FLAGS = {"GF", "DF", "NF", "VO"}


def _parse_delivery_clause(clause: str) -> tuple[int, str, str]:
    """Parse the delivery clause from a menu heading.

    Returns (delivery_fee_cents, scope, verbatim_clause).
    Examples seen:
      "$0 delivery"                              -> (0,  'none',                "$0 delivery")
      "$30 delivery per school per trip"         -> (3000, 'per_school_per_trip', ...)
      "$10 delivery per school per trip"         -> (1000, 'per_school_per_trip', ...)
      "$50 delivery per trip"                    -> (5000, 'per_trip',            ...)
    """
    m = re.match(r"\$(\d+(?:\.\d+)?)\s*delivery(?:\s+(.+))?$", clause.strip(), re.IGNORECASE)
    if not m:
        raise ValueError(f"Unrecognised delivery clause: {clause!r}")
    amount = float(m.group(1))
    fee_cents = int(round(amount * 100))
    qualifier = (m.group(2) or "").strip().lower()
    if fee_cents == 0:
        scope = "none"
    elif "per school per trip" in qualifier:
        scope = "per_school_per_trip"
    elif "per trip" in qualifier:
        scope = "per_trip"
    else:
        # Default to per_trip; surface as needs-review via the verbatim notes.
        scope = "per_trip"
    return fee_cents, scope, clause.strip()


def parse_caterer_menus_pdf(path: Path) -> list[ParsedMenu]:
    menus: list[ParsedMenu] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            # Collapse the soft line-break that splits "per\ntrip" across lines.
            text = re.sub(r"per\s*\n\s*trip", "per trip", text)
            lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
            if not lines:
                continue
            heading = lines[0]
            m = _MENU_HEADING_RE.match(heading)
            if not m:
                continue  # legend page or unknown
            caterer = m.group("caterer").strip()
            price_cents = int(round(float(m.group("price")) * 100))
            gst_inclusive = m.group("gst").lower() == "including"
            fee_cents, scope, delivery_notes = _parse_delivery_clause(m.group("delivery"))

            dishes: list[ParsedDish] = []
            for line in lines[1:]:
                # Trailing flag tokens are space-separated single/double uppercase letters.
                tokens = line.split()
                flags: set[str] = set()
                while tokens and tokens[-1] in _DECLARED_FLAGS:
                    flags.add(tokens.pop())
                name = " ".join(tokens).strip()
                if not name:
                    continue
                halal, halal_note = is_halal(name)
                dishes.append(
                    ParsedDish(
                        name=name,
                        name_raw=line,
                        declared_flags=flags,
                        has_no_declared_tags=(len(flags) == 0),
                        is_halal_inferred=halal,
                        halal_inference_note=halal_note,
                        ingredient_flags=infer_ingredient_flags(name),
                    )
                )

            menus.append(
                ParsedMenu(
                    caterer_name=caterer,
                    per_item_price_cents=price_cents,
                    gst_inclusive=gst_inclusive,
                    delivery_fee_cents=fee_cents,
                    delivery_scope=scope,
                    delivery_notes=delivery_notes,
                    dishes=dishes,
                )
            )
    return menus


# --- Caterer contacts (caterer-contacts.pdf) ------------------------------


@dataclass
class ParsedContact:
    display_name: str
    role: str  # 'primary' | 'secondary' | 'chef'
    email: str | None
    cc_preference: str  # 'cc' | 'do_not_cc' | 'unspecified'
    role_note: str | None


@dataclass
class ParsedCatererBlock:
    caterer_name: str
    contacts: list[ParsedContact]
    serves: list[str]  # raw school names from PDF
    able_to_serve: list[str]


_CATERER_HEADINGS = {
    "Lakehouse Victoria Point",
    "Terrific Noodles",
    "Kenko Sushi House",
    "Guzman y Gomez",
}


def parse_caterer_contacts_pdf(path: Path) -> list[ParsedCatererBlock]:
    with pdfplumber.open(path) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)

    lines = [ln.rstrip() for ln in text.splitlines()]
    # Group lines by caterer heading.
    blocks: list[ParsedCatererBlock] = []
    current: ParsedCatererBlock | None = None
    pending_lines: list[str] = []

    def flush(block: ParsedCatererBlock | None, raw: list[str]) -> None:
        if block is None:
            return
        # `raw` is the block's lines (without the heading).
        # Schools may wrap onto a continuation line — join continuation lines
        # that don't start with a known prefix.
        normalised: list[str] = []
        for line in raw:
            if not line.strip():
                continue
            if (
                normalised
                and not line.startswith("Serves:")
                and not line.startswith("Able to serve:")
                and "(" not in line
                and "@" not in line
                and not normalised[-1].endswith(("@", ":", ")"))
                and (
                    normalised[-1].startswith("Serves:")
                    or normalised[-1].startswith("Able to serve:")
                )
            ):
                normalised[-1] = normalised[-1].rstrip() + " " + line.strip()
            else:
                normalised.append(line.strip())

        contacts: list[ParsedContact] = []
        serves: list[str] = []
        able_to_serve: list[str] = []
        last_contact: ParsedContact | None = None

        contact_line_re = re.compile(r"^(?P<name>[^()]+?)\s*\((?P<note>[^)]+)\)\s*$")

        for line in normalised:
            if line.startswith("Serves:"):
                serves = [s.strip() for s in line[len("Serves:") :].split(",") if s.strip()]
            elif line.startswith("Able to serve:"):
                able_to_serve = [
                    s.strip() for s in line[len("Able to serve:") :].split(",") if s.strip()
                ]
            elif "@" in line and last_contact is not None and last_contact.email is None:
                last_contact.email = line.strip()
            else:
                m = contact_line_re.match(line)
                if m:
                    name = m.group("name").strip()
                    note = m.group("note").strip()
                    note_lower = note.lower()
                    # "main point of contact and chef" → primary (the person IS
                    # the primary contact, who also happens to cook). Pure chef
                    # notes ("chef – does not want to be cc'ed") → chef.
                    if "main point of contact" in note_lower:
                        role = "primary"
                    elif "chef" in note_lower:
                        role = "chef"
                    elif not contacts:
                        role = "primary"
                    else:
                        role = "secondary"
                    if "does not want to be cc" in note_lower or "not want to be cc" in note_lower:
                        cc_pref = "do_not_cc"
                    elif "wants to be cc" in note_lower:
                        cc_pref = "cc"
                    else:
                        cc_pref = "unspecified"
                    contact = ParsedContact(
                        display_name=name,
                        role=role,
                        email=None,
                        cc_preference=cc_pref,
                        role_note=note,
                    )
                    contacts.append(contact)
                    last_contact = contact

        block.contacts = contacts
        block.serves = serves
        block.able_to_serve = able_to_serve
        blocks.append(block)

    for line in lines:
        stripped = line.strip()
        if stripped in _CATERER_HEADINGS:
            flush(current, pending_lines)
            current = ParsedCatererBlock(
                caterer_name=stripped, contacts=[], serves=[], able_to_serve=[]
            )
            pending_lines = []
        else:
            pending_lines.append(line)
    flush(current, pending_lines)
    return blocks


# --- Sessions (sessions.xlsx) ---------------------------------------------


@dataclass
class ParsedSession:
    school_name: str  # raw — will be canonicalised by the pipeline
    caterer_name: str
    region: str | None
    session_date: date
    # source-provided day-of-week (e.g. "Tuesday"). Used for matching
    # students.xlsx sheet day suffixes to sessions.
    day_label: str
    start_time: time | None
    end_time: time | None
    dinner_time: time | None
    start_time_raw: str | None
    end_time_raw: str | None
    dinner_time_raw: str | None
    manager_name: str | None
    manager_mobile: str | None
    year_levels: list[int]
    building: str | None


def parse_sessions_xlsx(path: Path) -> list[ParsedSession]:
    df = pd.read_excel(path)
    out: list[ParsedSession] = []
    for _, row in df.iterrows():
        d = row["date"]
        if isinstance(d, pd.Timestamp):
            d = d.date()
        d = correct_source_operational_date(d)
        out.append(
            ParsedSession(
                school_name=str(row["school"]).strip(),
                caterer_name=str(row["caterer"]).strip(),
                region=str(row["region"]).strip() if pd.notna(row.get("region")) else None,
                session_date=d,
                day_label=str(row["day"]).strip(),
                start_time=parse_time_string(row.get("start-time")),
                end_time=parse_time_string(row.get("end-time")),
                dinner_time=parse_time_string(row.get("dinner-time")),
                start_time_raw=str(row.get("start-time"))
                if pd.notna(row.get("start-time"))
                else None,
                end_time_raw=str(row.get("end-time")) if pd.notna(row.get("end-time")) else None,
                dinner_time_raw=str(row.get("dinner-time"))
                if pd.notna(row.get("dinner-time"))
                else None,
                manager_name=str(row["manager"]).strip() if pd.notna(row.get("manager")) else None,
                manager_mobile=(
                    str(row["manager-mobile"]).strip()
                    if pd.notna(row.get("manager-mobile"))
                    else None
                ),
                year_levels=parse_year_levels(str(row["year-levels"])),
                building=str(row["Building"]).strip() if pd.notna(row.get("Building")) else None,
            )
        )
    return out


# --- Exclusions (exclusions.pdf) ------------------------------------------


@dataclass
class ParsedExclusion:
    school_name: str
    session_date: date
    excluded_year_levels: list[int]  # canonical: years removed from attendance
    reason: str
    source_text: str


_EXCLUSION_BLOCK_RE = re.compile(
    r"Exclusion\s+(?:One|Two|Three|\d+)\s*\n(.+?)(?=\nExclusion|\Z)", re.DOTALL
)


def parse_exclusions_pdf(path: Path) -> list[ParsedExclusion]:
    with pdfplumber.open(path) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)
    out: list[ParsedExclusion] = []
    for m in _EXCLUSION_BLOCK_RE.finditer(text):
        body = " ".join(m.group(1).split())
        school_match = re.search(r"session at (?P<school>.+?) on the", body, re.IGNORECASE)
        if not school_match:
            continue
        d = parse_ordinal_english_date(body, SOURCE_YEAR)
        if d is None:
            continue
        d = correct_source_operational_date(d)
        reason_match = re.search(r"due to (?P<reason>[^.]+)", body, re.IGNORECASE)
        reason = reason_match.group("reason").strip() if reason_match else ""

        # Year-levels affected. Only extract from the "cancelled for ..." clause
        # to avoid sweeping up sentences like "Year 11's will still attend".
        if "all year levels" in body.lower():
            year_levels: list[int] = []  # sentinel: "all"
        else:
            year_levels = []
            cancel_clause = re.search(
                r"cancelled for\s+(.+?)\s+(?:due to|for|$)", body, re.IGNORECASE
            )
            scope = cancel_clause.group(1) if cancel_clause else ""
            for part in re.split(r"and|,", scope):
                m_part = re.search(r"\d+", part)
                if m_part:
                    year_levels.append(int(m_part.group(0)))
            year_levels = sorted(set(year_levels))

        out.append(
            ParsedExclusion(
                school_name=school_match.group("school").strip(),
                session_date=d,
                excluded_year_levels=year_levels,
                reason=reason.rstrip(". "),
                source_text=body,
            )
        )
    return out


# --- Students (students.xlsx) ---------------------------------------------


@dataclass
class ParsedStudentRow:
    sheet_name: str
    short_code: str
    day_hint: str | None
    full_name: str
    year_level: int
    subjects_raw: str | None
    dietary_raw: str | None
    parsed_dietary: ParsedDietary
    student_email: str | None
    parent_name: str | None
    parent_email: str | None
    parent_mobile: str | None


def parse_students_xlsx(path: Path) -> list[ParsedStudentRow]:
    xl = pd.ExcelFile(path)
    out: list[ParsedStudentRow] = []
    for sheet in xl.sheet_names:
        short_code, day_hint = parse_student_sheet_name(sheet)
        df = pd.read_excel(path, sheet_name=sheet, skiprows=2)
        for _, row in df.iterrows():
            name = row.get("Student")
            if not isinstance(name, str) or not name.strip():
                continue
            dietary_raw = row.get("Dietary") if pd.notna(row.get("Dietary")) else None
            parsed = parse_dietary(dietary_raw)
            out.append(
                ParsedStudentRow(
                    sheet_name=sheet,
                    short_code=short_code,
                    day_hint=day_hint,
                    full_name=str(name).strip(),
                    year_level=int(row["Year Level"]),
                    subjects_raw=str(row["Subjects"]).strip()
                    if pd.notna(row.get("Subjects"))
                    else None,
                    dietary_raw=str(dietary_raw).strip() if dietary_raw else None,
                    parsed_dietary=parsed,
                    student_email=(
                        str(row["Student Email"]).strip()
                        if pd.notna(row.get("Student Email"))
                        else None
                    ),
                    parent_name=str(row["Parent"]).strip() if pd.notna(row.get("Parent")) else None,
                    parent_email=(
                        str(row["Parent Email"]).strip()
                        if pd.notna(row.get("Parent Email"))
                        else None
                    ),
                    parent_mobile=(
                        str(row["Parent Mobile"]).strip()
                        if pd.notna(row.get("Parent Mobile"))
                        else None
                    ),
                )
            )
    return out


# --- Absences (absences.pdf) ----------------------------------------------


@dataclass
class ParsedAbsence:
    school_name: str
    session_date: date
    student_full_name: str
    source_text: str


def parse_absences_pdf(path: Path) -> list[ParsedAbsence]:
    with pdfplumber.open(path) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)
    out: list[ParsedAbsence] = []
    current_school: str | None = None
    current_date: date | None = None
    current_header: str | None = None
    header_re = re.compile(
        r"^(?P<school>.+?)\s*-\s*(?P<d>\d{2})/(?P<m>\d{2})/(?P<y>\d{4})\s+Absences\s*$"
    )
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        m = header_re.match(stripped)
        if m:
            current_school = m.group("school").strip()
            current_date = correct_source_operational_date(
                date(int(m.group("y")), int(m.group("m")), int(m.group("d")))
            )
            current_header = stripped
        else:
            if current_school is None or current_date is None:
                continue
            out.append(
                ParsedAbsence(
                    school_name=current_school,
                    session_date=current_date,
                    student_full_name=stripped,
                    source_text=current_header or "",
                )
            )
    return out
