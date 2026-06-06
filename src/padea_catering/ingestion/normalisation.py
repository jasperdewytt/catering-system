"""Pure-function helpers for parsing and normalising source data.

Nothing in this module touches the database. All functions are deterministic
and unit-testable.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, time

# --- Schools ---------------------------------------------------------------

# Canonical names come from sessions.xlsx (with apostrophe where relevant).
SCHOOL_CANONICAL = {
    "MBBC": "Moreton Bay Boys' College",
    "JPC": "John Paul College",
    "MSHS": "MacGregor State High School",
    "ISHS": "Indooroopilly State High School",
    "LC": "Loreto College",
    "CHAC": "Cannon Hill Anglican College",
}

# Aliases observed in source files. E-21 — punctuation drift in
# `caterer-contacts.pdf` ("Moreton Bay Boys College" without the apostrophe).
SCHOOL_ALIASES = {
    "Moreton Bay Boys' College": [
        ("Moreton Bay Boys College", "caterer-contacts.pdf"),
    ],
}


def canonicalise_school_name(raw: str, alias_lookup: dict[str, str]) -> str:
    """Map a possibly-aliased school name to its canonical form.

    `alias_lookup` should be the in-DB alias table loaded as {alias: canonical_name}.
    Falls back to the raw name if no alias is found, on the assumption that the
    raw input *is* canonical.
    """
    raw_stripped = raw.strip()
    return alias_lookup.get(raw_stripped, raw_stripped)


# --- Students sheet name → (short_code, day_name | None) -------------------


# day_name is None when the sheet has only one session (MBBC, MSHS).
def parse_student_sheet_name(sheet: str) -> tuple[str, str | None]:
    """Parse a students.xlsx sheet name into (short_code, day_name | None).

    Examples:
        "MBBC"             -> ("MBBC", None)
        "JPC - Tuesday"    -> ("JPC", "Tuesday")
        "ISHS - Monday"    -> ("ISHS", "Monday")
    """
    if " - " in sheet:
        code, day = sheet.split(" - ", 1)
        return code.strip(), day.strip()
    return sheet.strip(), None


# --- Times -----------------------------------------------------------------

_TIME_RE = re.compile(r"^\s*(\d{1,2}):(\d{2})\s*(am|pm)\s*$", re.IGNORECASE)


def parse_time_string(raw: str | None) -> time | None:
    """Parse strings like "4:00pm" / "11:30am" into a `time`. Returns None on blank."""
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None
    m = _TIME_RE.match(s)
    if not m:
        return None
    h, mn, ampm = int(m.group(1)), int(m.group(2)), m.group(3).lower()
    if ampm == "pm" and h != 12:
        h += 12
    elif ampm == "am" and h == 12:
        h = 0
    return time(h, mn)


# --- Dates (ordinal English) -----------------------------------------------

_ORDINAL_DATE_RE = re.compile(r"(\d{1,2})(?:st|nd|rd|th)\s+of\s+([A-Za-z]+)", re.IGNORECASE)
_MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def parse_ordinal_english_date(text: str, year: int) -> date | None:
    """Parse "2nd of May" / "4th of May" → date(year, month, day). Returns None on miss."""
    m = _ORDINAL_DATE_RE.search(text)
    if not m:
        return None
    day = int(m.group(1))
    month = _MONTHS.get(m.group(2).lower())
    if not month:
        return None
    return date(year, month, day)


def correct_source_operational_date(value: date) -> date:
    """Correct the source fixture's transcribed May dates to the intended June week.

    The raw files must remain immutable, but the provided 2026 session week was
    entered as May 1-4 while its weekday labels match June 1-4. Keep the fix
    deliberately narrow so ordinary May dates in future data are not rewritten.
    """
    if value.year == 2026 and value.month == 5 and 1 <= value.day <= 4:
        return date(2026, 6, value.day)
    return value


# --- Year levels -----------------------------------------------------------


def parse_year_levels(raw: str) -> list[int]:
    """Parse "12, 11, 10, 9" into [9, 10, 11, 12] (sorted ascending)."""
    out = []
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit():
            out.append(int(part))
    return sorted(set(out))


# --- Dietary parsing -------------------------------------------------------

# Maps a normalised dietary phrase (lower-case, single-spaced) to a tag code.
# Order matters: longer / more specific phrases first so e.g. "no red meat"
# doesn't get matched as just "no" + "red meat".
DIETARY_PHRASE_TO_TAG: list[tuple[str, str]] = [
    ("opted out of catering", "_OPTED_OUT"),  # sentinel
    ("no red meat", "excludes_red_meat"),
    ("no shellfish", "excludes_shellfish"),
    ("no seafood", "excludes_seafood"),
    ("no beef", "excludes_beef"),
    ("no pork", "excludes_pork"),
    ("no fish", "excludes_fish"),
    ("gluten free", "gluten_free"),
    ("dairy free", "dairy_free"),
    ("nut free", "nut_free"),
    ("vegetarian", "vegetarian"),
    ("halal", "halal"),
]


@dataclass
class ParsedDietary:
    tag_codes: list[str]
    opted_out: bool
    unrecognised: list[str]  # raw fragments that didn't match any phrase


def parse_dietary(raw: str | None) -> ParsedDietary:
    """Parse a Dietary cell into structured tags + opted_out flag + unrecognised.

    Splits on commas, normalises whitespace/casing, and matches each fragment
    against `DIETARY_PHRASE_TO_TAG`. The sentinel "_OPTED_OUT" sets opted_out
    rather than being added as a tag (per D-06).

    Returns ParsedDietary(tag_codes=[], opted_out=False, unrecognised=[]) for
    None / blank input (D-04: null = no restriction, no warning).
    """
    if raw is None or not str(raw).strip():
        return ParsedDietary(tag_codes=[], opted_out=False, unrecognised=[])

    fragments = [f.strip() for f in str(raw).split(",") if f.strip()]
    codes: list[str] = []
    opted_out = False
    unrecognised: list[str] = []
    for frag in fragments:
        normalised = " ".join(frag.lower().split())
        matched = False
        for phrase, code in DIETARY_PHRASE_TO_TAG:
            if normalised == phrase:
                matched = True
                if code == "_OPTED_OUT":
                    opted_out = True
                elif code not in codes:
                    codes.append(code)
                break
        if not matched:
            unrecognised.append(frag)
    return ParsedDietary(tag_codes=codes, opted_out=opted_out, unrecognised=unrecognised)


# --- Halal inference (E-19) ------------------------------------------------

# Per the menu PDF's "Assume all non-pork meals are halal" rule.
# Conservative: any dish whose name mentions pork-indicating ingredients
# is treated as not halal.
PORK_INDICATORS = ("pork", "bacon", "ham", "prosciutto", "pancetta", "salami", "chorizo")


def is_halal(dish_name: str) -> tuple[bool, str | None]:
    """Return (is_halal, reason_if_not).

    Conservative rule: if the dish name contains any pork indicator, it is
    not halal. Otherwise halal per the menu PDF rule.
    """
    name_lower = dish_name.lower()
    for indicator in PORK_INDICATORS:
        if indicator in name_lower:
            return False, f"contains {indicator}"
    return True, None


# --- Ingredient inference (D-08) --------------------------------------------

BEEF_INDICATORS = ("beef", "bolognese", "meatball")
RED_MEAT_INDICATORS = BEEF_INDICATORS + ("lamb",)
FISH_INDICATORS = ("fish", "salmon", "tuna", "cod")
SHELLFISH_INDICATORS = ("shrimp", "prawn", "crab", "lobster")


@dataclass(frozen=True)
class IngredientFlags:
    contains_beef: bool
    contains_pork: bool
    contains_red_meat: bool
    contains_fish: bool
    contains_shellfish: bool


def infer_ingredient_flags(dish_name: str) -> IngredientFlags:
    """Infer obvious ingredient flags from dish names as a reviewable stop-gap.

    These flags are deterministic and auditable, but they are not a substitute
    for operator-reviewed ingredients.
    """
    name_lower = dish_name.lower()

    def has_any(indicators: tuple[str, ...]) -> bool:
        return any(indicator in name_lower for indicator in indicators)

    return IngredientFlags(
        contains_beef=has_any(BEEF_INDICATORS),
        contains_pork=has_any(PORK_INDICATORS),
        contains_red_meat=has_any(RED_MEAT_INDICATORS),
        contains_fish=has_any(FISH_INDICATORS),
        contains_shellfish=has_any(SHELLFISH_INDICATORS),
    )
