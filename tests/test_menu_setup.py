"""Unit tests for menu setup helper rules."""

from __future__ import annotations

from padea_catering.menu_setup import validate_offer_count


def test_validate_offer_count_accepts_recorded_tier() -> None:
    assert validate_offer_count(4, {4, 5, 6}) == []


def test_validate_offer_count_rejects_zero() -> None:
    assert validate_offer_count(0, {4, 5, 6}) == ["Select at least one offered option."]


def test_validate_offer_count_rejects_unrecorded_tier() -> None:
    assert validate_offer_count(3, {4, 5, 6}) == [
        "Select one of the valid option counts: [4, 5, 6]."
    ]
