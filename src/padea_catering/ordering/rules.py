"""Pure deterministic ordering rules.

These functions deliberately avoid database access so dietary filtering and dish
choice can be tested without Supabase.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DishOption:
    id: str
    name: str
    is_gluten_free: bool = False
    is_dairy_free: bool = False
    is_nut_free: bool = False
    is_vegetarian_option: bool = False
    is_halal_inferred: bool = False
    has_no_declared_tags: bool = False
    contains_beef: bool = False
    contains_pork: bool = False
    contains_red_meat: bool = False
    contains_fish: bool = False
    contains_shellfish: bool = False
    ingredient_flags_source: str = "unreviewed"


def dish_failure_reasons(dish: DishOption, tag_codes: set[str]) -> list[str]:
    """Return deterministic reasons a dish is unsafe for the student's tags."""
    reasons: list[str] = []
    has_restrictions = bool(tag_codes)

    if (
        has_restrictions
        and dish.has_no_declared_tags
        and dish.ingredient_flags_source == "unreviewed"
    ):
        reasons.append("unreviewed_untagged_dish")

    if "vegetarian" in tag_codes and not dish.is_vegetarian_option:
        reasons.append("not_vegetarian_option")
    if "nut_free" in tag_codes and not dish.is_nut_free:
        reasons.append("not_nut_free")
    if "gluten_free" in tag_codes and not dish.is_gluten_free:
        reasons.append("not_gluten_free")
    if "dairy_free" in tag_codes and not dish.is_dairy_free:
        reasons.append("not_dairy_free")
    if "halal" in tag_codes and (not dish.is_halal_inferred or dish.contains_pork):
        reasons.append("not_halal")

    if "excludes_beef" in tag_codes and dish.contains_beef:
        reasons.append("contains_beef")
    if "excludes_pork" in tag_codes and dish.contains_pork:
        reasons.append("contains_pork")
    if "excludes_red_meat" in tag_codes and (dish.contains_red_meat or dish.contains_beef):
        reasons.append("contains_red_meat")
    if "excludes_fish" in tag_codes and dish.contains_fish:
        reasons.append("contains_fish")
    if "excludes_shellfish" in tag_codes and dish.contains_shellfish:
        reasons.append("contains_shellfish")
    if "excludes_seafood" in tag_codes and (dish.contains_fish or dish.contains_shellfish):
        reasons.append("contains_seafood")

    return reasons


def is_safe_dish(dish: DishOption, tag_codes: set[str]) -> bool:
    return not dish_failure_reasons(dish, tag_codes)


def choose_dish(
    offered_dishes: list[DishOption],
    tag_codes: set[str],
    allocation_counts: dict[str, int],
) -> DishOption | None:
    """Pick the safest deterministic dish, balancing counts within a session."""
    safe = [dish for dish in offered_dishes if is_safe_dish(dish, tag_codes)]
    if not safe:
        return None
    return sorted(safe, key=lambda dish: (allocation_counts.get(dish.id, 0), dish.name, dish.id))[0]
