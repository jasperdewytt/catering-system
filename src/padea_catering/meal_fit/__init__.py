"""Preference-aware meal-fit planning."""

from .engine import (
    ALGORITHM_VERSION,
    build_preference_aware_order_plan,
    generate_preference_aware_order_run,
)

__all__ = [
    "ALGORITHM_VERSION",
    "build_preference_aware_order_plan",
    "generate_preference_aware_order_run",
]
