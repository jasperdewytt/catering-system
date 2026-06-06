"""Unit tests for meal-fit offer-set selection."""

from __future__ import annotations

from padea_catering.meal_fit.engine import (
    MAX_ENUMERATED_SUBSETS,
    StudentDemand,
    VariantCandidate,
    select_offer_set_for_caterer,
)
from padea_catering.meal_fit.scoring import (
    DishTag,
    MealFitScoringConfig,
    PreferenceSignal,
    StudentPreferenceProfile,
)
from padea_catering.ordering.rules import DishOption


def _candidate(
    variant_id: str,
    name: str,
    *tags: str,
    is_vegetarian_option: bool = True,
    is_halal_inferred: bool = True,
    contains_pork: bool = False,
) -> VariantCandidate:
    return VariantCandidate(
        option=DishOption(
            id=variant_id,
            dish_id=f"dish-{variant_id}",
            name=name,
            is_vegetarian_option=is_vegetarian_option,
            is_halal_inferred=is_halal_inferred,
            contains_pork=contains_pork,
            ingredient_flags_source="operator_reviewed",
        ),
        caterer_id="caterer-1",
        dish_id=f"dish-{variant_id}",
        display_name=name,
        tags=tuple(DishTag(tag, 1.0) for tag in tags),
    )


def _demand(student_id: str, *dietary_tags: str) -> StudentDemand:
    return StudentDemand(
        session_id="session-1",
        student_id=student_id,
        caterer_id="caterer-1",
        dietary_tag_codes=tuple(dietary_tags),
    )


def test_unsafe_variant_is_never_selected_despite_preference_score() -> None:
    selected = select_offer_set_for_caterer(
        caterer_id="caterer-1",
        candidates=[
            _candidate("unsafe", "Pork Wrap", "wrap", is_halal_inferred=False, contains_pork=True),
            _candidate("safe", "Rice Bowl", "rice"),
        ],
        minimum_tiers=[{"menu_item_count": 1, "minimum_meals": 0}],
        demand=[_demand("student-1", "halal")],
        profiles_by_student={
            "student-1": StudentPreferenceProfile(
                tag_signals={"wrap": PreferenceSignal(1.0, 1.0, 4)}
            )
        },
        scoring_config=MealFitScoringConfig(),
    )

    assert selected is not None
    assert selected.variant_ids == ("safe",)


def test_hard_dietary_coverage_rejects_incomplete_offer_sets() -> None:
    selected = select_offer_set_for_caterer(
        caterer_id="caterer-1",
        candidates=[
            _candidate("meat", "Chicken Wrap", "wrap", is_vegetarian_option=False),
        ],
        minimum_tiers=[{"menu_item_count": 1, "minimum_meals": 0}],
        demand=[_demand("student-1", "vegetarian")],
        profiles_by_student={},
        scoring_config=MealFitScoringConfig(),
    )

    assert selected is None


def test_moq_waste_objective_prefers_smaller_tier_when_added_fit_is_not_worth_waste() -> None:
    selected = select_offer_set_for_caterer(
        caterer_id="caterer-1",
        candidates=[
            _candidate("bowl", "Rice Bowl", "rice"),
            _candidate("wrap", "Wrap", "wrap"),
        ],
        minimum_tiers=[
            {"menu_item_count": 1, "minimum_meals": 0},
            {"menu_item_count": 2, "minimum_meals": 12},
        ],
        demand=[_demand("student-1"), _demand("student-2")],
        profiles_by_student={
            "student-1": StudentPreferenceProfile(
                tag_signals={"rice": PreferenceSignal(0.1, 1.0, 4)}
            )
        },
        scoring_config=MealFitScoringConfig(),
    )

    assert selected is not None
    assert selected.menu_item_count == 1
    assert selected.forced_waste == 0


def test_tie_breaking_is_stable_across_runs() -> None:
    candidates = [
        _candidate("a", "Alpha", "rice"),
        _candidate("b", "Beta", "rice"),
        _candidate("c", "Charlie", "rice"),
    ]

    first = select_offer_set_for_caterer(
        caterer_id="caterer-1",
        candidates=candidates,
        minimum_tiers=[{"menu_item_count": 2, "minimum_meals": 0}],
        demand=[_demand("student-1")],
        profiles_by_student={},
        scoring_config=MealFitScoringConfig(),
    )
    second = select_offer_set_for_caterer(
        caterer_id="caterer-1",
        candidates=list(reversed(candidates)),
        minimum_tiers=[{"menu_item_count": 2, "minimum_meals": 0}],
        demand=[_demand("student-1")],
        profiles_by_student={},
        scoring_config=MealFitScoringConfig(),
    )

    assert first is not None
    assert second is not None
    assert first.variant_ids == second.variant_ids


def test_greedy_fallback_triggers_above_subset_limit_and_is_stable() -> None:
    candidates = [
        _candidate(f"variant-{index:02d}", f"Variant {index:02d}", "rice") for index in range(20)
    ]
    assert MAX_ENUMERATED_SUBSETS < 184_756

    selected = select_offer_set_for_caterer(
        caterer_id="caterer-1",
        candidates=candidates,
        minimum_tiers=[{"menu_item_count": 10, "minimum_meals": 0}],
        demand=[_demand("student-1"), _demand("student-2")],
        profiles_by_student={},
        scoring_config=MealFitScoringConfig(),
    )

    assert selected is not None
    assert selected.method == "greedy"
    assert selected.variant_ids == tuple(f"variant-{index:02d}" for index in range(10))
