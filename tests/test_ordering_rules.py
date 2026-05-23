"""Unit tests for deterministic ordering safety rules."""

from __future__ import annotations

from padea_catering.ordering.rules import DishOption, choose_dish, dish_failure_reasons


def test_declared_dietary_tags_filter_dish_fields() -> None:
    dish = DishOption(
        id="dish-1",
        name="Pasta",
        is_gluten_free=False,
        is_dairy_free=False,
        is_nut_free=True,
        is_vegetarian_option=False,
        is_halal_inferred=True,
        ingredient_flags_source="keyword_inferred",
    )

    assert dish_failure_reasons(dish, {"nut_free"}) == []
    assert dish_failure_reasons(dish, {"gluten_free"}) == ["not_gluten_free"]
    assert dish_failure_reasons(dish, {"vegetarian"}) == ["not_vegetarian_option"]
    assert dish_failure_reasons(dish, {"dairy_free"}) == ["not_dairy_free"]


def test_halal_rejects_pork_even_if_halal_inferred_is_wrong() -> None:
    dish = DishOption(
        id="dish-1",
        name="Bacon Wrap",
        is_halal_inferred=True,
        contains_pork=True,
        ingredient_flags_source="keyword_inferred",
    )

    assert dish_failure_reasons(dish, {"halal"}) == ["not_halal"]


def test_exclusion_tags_filter_ingredient_flags() -> None:
    dish = DishOption(
        id="dish-1",
        name="Surf and Turf",
        contains_beef=True,
        contains_red_meat=True,
        contains_fish=True,
        contains_shellfish=True,
        ingredient_flags_source="keyword_inferred",
    )

    assert "contains_beef" in dish_failure_reasons(dish, {"excludes_beef"})
    assert "contains_red_meat" in dish_failure_reasons(dish, {"excludes_red_meat"})
    assert "contains_fish" in dish_failure_reasons(dish, {"excludes_fish"})
    assert "contains_shellfish" in dish_failure_reasons(dish, {"excludes_shellfish"})
    assert "contains_seafood" in dish_failure_reasons(dish, {"excludes_seafood"})


def test_unreviewed_untagged_dish_rejected_for_restricted_student() -> None:
    dish = DishOption(
        id="dish-1",
        name="Mystery Burrito",
        has_no_declared_tags=True,
        ingredient_flags_source="unreviewed",
    )

    assert dish_failure_reasons(dish, {"halal"}) == [
        "unreviewed_untagged_dish",
        "not_halal",
    ]
    assert dish_failure_reasons(dish, set()) == []


def test_keyword_inferred_untagged_dish_can_be_considered_with_warnings_elsewhere() -> None:
    dish = DishOption(
        id="dish-1",
        name="Cali Burrito",
        has_no_declared_tags=True,
        is_halal_inferred=True,
        ingredient_flags_source="keyword_inferred",
    )

    assert dish_failure_reasons(dish, {"halal"}) == []


def test_choose_dish_balances_then_tiebreaks_by_name_and_id() -> None:
    dishes = [
        DishOption(id="b", name="Zulu", is_halal_inferred=True),
        DishOption(id="a", name="Alpha", is_halal_inferred=True),
        DishOption(id="c", name="Beta", is_halal_inferred=True),
    ]

    chosen = choose_dish(dishes, {"halal"}, {"a": 2, "c": 1})

    assert chosen is not None
    assert chosen.id == "b"


def test_choose_dish_returns_none_when_no_safe_dish() -> None:
    dishes = [DishOption(id="dish-1", name="Beef Bowl", contains_beef=True)]

    assert choose_dish(dishes, {"excludes_beef"}, {}) is None
