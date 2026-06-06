"""Persisted Stage 6 advisory AI interpretation actions."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from supabase import Client

from .prompts import SYSTEM_PROMPT, build_prompt
from .providers import AnthropicClaudeProvider, LLMProvider
from .schemas import (
    MODEL_BY_PURPOSE,
    PROMPT_VERSIONS,
    parse_stage6_response,
    parse_stage6_structured_response,
)


def interpret_dish_variant_tags(
    client: Client,
    dish_variant_id: str,
    provider: LLMProvider | None = None,
) -> dict[str, Any]:
    variant = _select_one(client, "dish_variants", dish_variant_id)
    dish = _select_one(client, "dishes", variant["dish_id"])
    raw_input = {
        "dish_variant_id": dish_variant_id,
        "dish_name": dish.get("name"),
        "variant_name": variant.get("name"),
        "ingredient_notes": dish.get("ingredient_notes"),
    }
    return _interpret(
        client,
        purpose="dish_tagging",
        raw_input=raw_input,
        provider=provider,
        foreign_keys={},
    )


def interpret_student_feedback(
    client: Client,
    student_meal_feedback_id: str,
    provider: LLMProvider | None = None,
) -> dict[str, Any]:
    feedback = _select_one(client, "student_meal_feedback", student_meal_feedback_id)
    raw_input = {
        "student_meal_feedback_id": student_meal_feedback_id,
        "rating": feedback.get("rating"),
        "liked": feedback.get("liked"),
        "free_text": feedback.get("free_text"),
        "requested_food": feedback.get("requested_food"),
        "source": feedback.get("source"),
    }
    return _interpret(
        client,
        purpose="student_feedback",
        raw_input=raw_input,
        provider=provider,
        foreign_keys={"student_meal_feedback_id": student_meal_feedback_id},
    )


def interpret_manager_feedback(
    client: Client,
    session_catering_feedback_id: str,
    provider: LLMProvider | None = None,
) -> dict[str, Any]:
    feedback = _select_one(client, "session_catering_feedback", session_catering_feedback_id)
    raw_input = {
        "session_catering_feedback_id": session_catering_feedback_id,
        "delivery_status": feedback.get("delivery_status"),
        "food_quality_rating": feedback.get("food_quality_rating"),
        "leftover_level": feedback.get("leftover_level"),
        "issue_tags": feedback.get("issue_tags") or [],
        "manager_notes": feedback.get("manager_notes"),
        "source": feedback.get("source"),
    }
    return _interpret(
        client,
        purpose="manager_feedback",
        raw_input=raw_input,
        provider=provider,
        foreign_keys={"session_catering_feedback_id": session_catering_feedback_id},
    )


def interpret_caterer_reply(
    client: Client,
    caterer_reply_id: str,
    provider: LLMProvider | None = None,
) -> dict[str, Any]:
    reply = _select_one(client, "caterer_reply_intake", caterer_reply_id)
    raw_input = {
        "caterer_reply_id": caterer_reply_id,
        "from_email": reply.get("from_email"),
        "subject": reply.get("subject"),
        "raw_body": reply.get("raw_body"),
        "received_at": reply.get("received_at"),
    }
    interpretation = _interpret(
        client,
        purpose="caterer_reply",
        raw_input=raw_input,
        provider=provider,
        foreign_keys={"caterer_reply_id": caterer_reply_id},
    )
    client.table("caterer_reply_intake").update({"ai_interpretation_id": interpretation["id"]}).eq(
        "id", caterer_reply_id
    ).execute()
    return interpretation


def explain_autopilot_exception(
    client: Client,
    autopilot_exception_id: str,
    provider: LLMProvider | None = None,
) -> dict[str, Any]:
    exception = _select_one(client, "autopilot_exceptions", autopilot_exception_id)
    raw_input = {
        "autopilot_exception_id": autopilot_exception_id,
        "severity": exception.get("severity"),
        "category": exception.get("category"),
        "title": exception.get("title"),
        "detail": exception.get("detail"),
        "recommended_action": exception.get("recommended_action"),
        "metadata": exception.get("metadata") or {},
    }
    return _interpret(
        client,
        purpose="exception_explanation",
        raw_input=raw_input,
        provider=provider,
        foreign_keys={"autopilot_exception_id": autopilot_exception_id},
    )


def interpret_exception_resolution(
    client: Client,
    *,
    autopilot_exception_id: str,
    raw_input: dict[str, Any],
    provider: LLMProvider | None = None,
) -> dict[str, Any]:
    """Interpret an operator instruction without applying operational changes."""
    return _interpret(
        client,
        purpose="exception_resolution",
        raw_input={
            "autopilot_exception_id": autopilot_exception_id,
            **raw_input,
        },
        provider=provider,
        foreign_keys={"autopilot_exception_id": autopilot_exception_id},
    )


def stable_input_hash(*, prompt_version: str, raw_input: dict[str, Any]) -> str:
    payload = json.dumps(
        {"prompt_version": prompt_version, "raw_input": raw_input},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _interpret(
    client: Client,
    *,
    purpose: str,
    raw_input: dict[str, Any],
    provider: LLMProvider | None,
    foreign_keys: dict[str, str],
) -> dict[str, Any]:
    provider = provider or AnthropicClaudeProvider.from_env()
    prompt_version = PROMPT_VERSIONS[purpose]
    user_prompt = build_prompt(
        purpose=purpose,
        prompt_version=prompt_version,
        raw_input=raw_input,
    )
    completion = provider.complete(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=MODEL_BY_PURPOSE[purpose],
    )
    if completion.structured_output:
        parsed_output, validation_metadata = parse_stage6_structured_response(
            purpose,
            completion.raw_output,
        )
    else:
        parsed_output, validation_metadata = parse_stage6_response(
            purpose,
            completion.raw_output,
        )
    metadata = {**completion.metadata, **validation_metadata}
    row = {
        "purpose": purpose,
        "provider": provider.provider_name,
        "model": provider.model,
        "prompt_version": prompt_version,
        "schema_version": parsed_output["schema_version"],
        "input_hash": stable_input_hash(prompt_version=prompt_version, raw_input=raw_input),
        "raw_input": json.dumps(raw_input, sort_keys=True, default=str),
        "raw_output": completion.raw_output,
        "parsed_output": parsed_output,
        "confidence": parsed_output.get("confidence"),
        "needs_human_review": parsed_output.get("needs_human_review", True),
        "metadata": metadata,
        **foreign_keys,
    }
    return client.table("ai_interpretations").insert(row).execute().data[0]


def _select(client: Client, table: str, columns: str = "*", **eq: Any) -> list[dict[str, Any]]:
    query = client.table(table).select(columns)
    for key, value in eq.items():
        query = query.eq(key, value)
    return query.execute().data


def _select_one(client: Client, table: str, row_id: str) -> dict[str, Any]:
    rows = _select(client, table, id=row_id)
    if not rows:
        raise ValueError(f"{table} row {row_id!r} does not exist.")
    return rows[0]
