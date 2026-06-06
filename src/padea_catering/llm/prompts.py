"""Prompt builders for frozen Stage 6 contracts."""

from __future__ import annotations

import json
from typing import Any

from .taxonomy import allowed_tags_text

SYSTEM_PROMPT = (
    "You are an advisory parser for Padea catering operations. "
    "Do not decide dietary safety, allergies, attendance, exclusions, quantities, allocation, "
    "order approval, recipients, or whether an email may be sent. If uncertain, set "
    "needs_human_review to true and use other_for_review instead of inventing tags."
)


def build_prompt(*, purpose: str, prompt_version: str, raw_input: dict[str, Any]) -> str:
    """Build a stable prompt for one frozen contract."""
    return "\n".join(
        [
            f"Purpose: {purpose}",
            f"Prompt version: {prompt_version}",
            "Schema version: 1",
            f"Allowed preference tags: {allowed_tags_text()}",
            "Extract the requested facts only. The API response schema defines the output shape.",
            (
                "For caterer_reply intent, use exactly one of: confirmed, unavailable_item, "
                "quantity_question, delivery_question, ingredient_change, ambiguous, other."
            ),
            (
                "For caterer_reply, do not set needs_human_review to true solely because an "
                "unavailable item has no proposed replacement; deterministic Python policy "
                "will decide whether a safe replacement can be inferred."
            ),
            (
                "For exception_resolution, interpret the operator instruction only. Use exact "
                "current-order and available-dish names from the input where possible. Quantity, "
                "delivery, and general answers are reply_only. Never claim a replacement is safe."
            ),
            "Input:",
            json.dumps(raw_input, sort_keys=True, default=str),
        ]
    )
