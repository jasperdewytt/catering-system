"""Unit tests for the deterministic parsing helpers."""

from __future__ import annotations

from datetime import date, time

import pytest

from padea_catering.ingestion.normalisation import (
    canonicalise_school_name,
    is_halal,
    parse_dietary,
    parse_ordinal_english_date,
    parse_student_sheet_name,
    parse_time_string,
    parse_year_levels,
)


class TestParseTime:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("4:00pm", time(16, 0)),
            ("11:30am", time(11, 30)),
            ("12:00pm", time(12, 0)),
            ("12:00am", time(0, 0)),
            ("7:30pm", time(19, 30)),
        ],
    )
    def test_valid(self, raw: str, expected: time) -> None:
        assert parse_time_string(raw) == expected

    def test_none(self) -> None:
        assert parse_time_string(None) is None

    def test_blank(self) -> None:
        assert parse_time_string("   ") is None

    def test_unrecognised(self) -> None:
        assert parse_time_string("noonish") is None


class TestParseOrdinalDate:
    def test_basic(self) -> None:
        assert parse_ordinal_english_date("on the 2nd of May", 2026) == date(2026, 5, 2)

    def test_various_ordinals(self) -> None:
        assert parse_ordinal_english_date("3rd of May", 2026) == date(2026, 5, 3)
        assert parse_ordinal_english_date("4th of May", 2026) == date(2026, 5, 4)
        assert parse_ordinal_english_date("1st of June", 2026) == date(2026, 6, 1)

    def test_no_match(self) -> None:
        assert parse_ordinal_english_date("nope", 2026) is None


class TestParseYearLevels:
    def test_descending_source(self) -> None:
        assert parse_year_levels("12, 11, 10, 9") == [9, 10, 11, 12]

    def test_partial(self) -> None:
        assert parse_year_levels("12, 11") == [11, 12]

    def test_dedup(self) -> None:
        assert parse_year_levels("12, 12, 11") == [11, 12]


class TestParseStudentSheetName:
    def test_with_day(self) -> None:
        assert parse_student_sheet_name("JPC - Tuesday") == ("JPC", "Tuesday")

    def test_no_day(self) -> None:
        assert parse_student_sheet_name("MBBC") == ("MBBC", None)

    def test_chac_wed(self) -> None:
        assert parse_student_sheet_name("CHAC - Wednesday") == ("CHAC", "Wednesday")


class TestParseDietary:
    def test_blank(self) -> None:
        r = parse_dietary(None)
        assert r.tag_codes == []
        assert r.opted_out is False
        assert r.unrecognised == []

    def test_single_phrase(self) -> None:
        r = parse_dietary("Halal")
        assert r.tag_codes == ["halal"]
        assert r.opted_out is False

    def test_multi_phrase(self) -> None:
        r = parse_dietary("Nut Free, No Shellfish, Opted out of Catering")
        assert r.tag_codes == ["nut_free", "excludes_shellfish"]
        assert r.opted_out is True
        assert r.unrecognised == []

    def test_no_red_meat_not_split_as_no_meat(self) -> None:
        # The longer phrase must match first so "No Red Meat" doesn't
        # accidentally become "No" + "Red Meat" (neither of which are tags).
        r = parse_dietary("No Red Meat")
        assert r.tag_codes == ["excludes_red_meat"]

    def test_unrecognised(self) -> None:
        r = parse_dietary("Halal, Eats only blue food")
        assert r.tag_codes == ["halal"]
        assert r.unrecognised == ["Eats only blue food"]


class TestCanonicaliseSchoolName:
    ALIAS_LOOKUP = {
        "Moreton Bay Boys College": "Moreton Bay Boys' College",
    }

    def test_alias_resolves_to_canonical(self) -> None:
        assert (
            canonicalise_school_name("Moreton Bay Boys College", self.ALIAS_LOOKUP)
            == "Moreton Bay Boys' College"
        )

    def test_canonical_input_passes_through(self) -> None:
        # Already canonical — should be returned unchanged.
        assert (
            canonicalise_school_name("Moreton Bay Boys' College", self.ALIAS_LOOKUP)
            == "Moreton Bay Boys' College"
        )

    def test_unknown_passes_through(self) -> None:
        # No alias known — assume the input is canonical.
        assert canonicalise_school_name("Some New School", self.ALIAS_LOOKUP) == "Some New School"

    def test_whitespace_stripped(self) -> None:
        assert (
            canonicalise_school_name("  Moreton Bay Boys College  ", self.ALIAS_LOOKUP)
            == "Moreton Bay Boys' College"
        )


class TestIsHalal:
    def test_no_pork_indicator(self) -> None:
        ok, note = is_halal("Sweet and Sour Chicken")
        assert ok is True
        assert note is None

    def test_bacon(self) -> None:
        ok, note = is_halal("Bacon Carbonara")
        assert ok is False
        assert note == "contains bacon"

    def test_pork(self) -> None:
        ok, note = is_halal("Pulled pork burrito bowl")
        assert ok is False
        assert note == "contains pork"

    def test_case_insensitive(self) -> None:
        ok, _ = is_halal("PULLED PORK BURRITO BOWL")
        assert ok is False
