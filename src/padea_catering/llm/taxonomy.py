"""Closed preference/style taxonomy for Stage 6 AI parsing."""

from __future__ import annotations

CANONICAL_PREFERENCE_TAGS = {
    "mexican",
    "italian",
    "japanese",
    "asian",
    "middle_eastern",
    "modern_australian",
    "american",
    "mediterranean",
    "wrap",
    "bowl",
    "pasta",
    "rice",
    "salad",
    "sandwich",
    "burger",
    "pizza",
    "sushi",
    "snack",
    "dessert",
    "noodle",
    "curry",
    "spicy",
    "mild",
    "creamy",
    "cheesy",
    "saucy",
    "fresh",
    "crispy",
    "hot_food",
    "cold_food",
    "plain",
    "chicken_style",
    "beef_style",
    "seafood_style",
    "vegetarian_style",
    "plant_based",
    "egg_style",
    "familiar_food",
    "light_meal",
    "filling_meal",
    "sweet",
    "savory",
    "easy_to_eat",
    "customisable",
    "other_for_review",
}

QUALITY_ISSUE_TAGS = {"cold_food", "spicy", "food_quality", "other_for_review"}
MANAGER_ISSUE_TAGS = {
    "late_delivery",
    "missing_items",
    "food_quality",
    "student_dislike",
    "manager_complaint",
    "other_for_review",
}


def allowed_tags_text() -> str:
    """Return a stable prompt-friendly representation of canonical tags."""
    return ", ".join(sorted(CANONICAL_PREFERENCE_TAGS))
