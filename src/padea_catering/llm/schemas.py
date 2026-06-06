"""Frozen Stage 6 response schemas and validation helpers."""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .taxonomy import CANONICAL_PREFERENCE_TAGS, MANAGER_ISSUE_TAGS, QUALITY_ISSUE_TAGS

SCHEMA_VERSION = "1"
PROMPT_VERSIONS = {
    "dish_tagging": "dish_tags_v1",
    "student_feedback": "student_feedback_v1",
    "manager_feedback": "manager_feedback_v1",
    "caterer_reply": "caterer_reply_v1",
    "exception_explanation": "exception_explanation_v1",
    "exception_resolution": "exception_resolution_v1",
}


class Stage6Model(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1"]
    prompt_version: str
    confidence: float = Field(ge=0, le=1)
    needs_human_review: bool


class DishTagSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    confidence: float = Field(ge=0, le=1)
    reason: str


class DishTagsResponse(Stage6Model):
    prompt_version: Literal["dish_tags_v1"]
    dish_variant_id: str | None
    tags: list[DishTagSuggestion]
    notes: str


class StudentFeedbackResponse(Stage6Model):
    prompt_version: Literal["student_feedback_v1"]
    sentiment: Literal["positive", "neutral", "negative", "mixed", "unknown"]
    liked_tags: list[str]
    disliked_tags: list[str]
    requested_tags: list[str]
    requested_food_text: str | None
    quality_issues: list[str]
    summary: str


class ManagerFeedbackResponse(Stage6Model):
    prompt_version: Literal["manager_feedback_v1"]
    delivery_status: Literal["on_time", "late", "missing_items", "wrong_items", "unknown"]
    food_quality_rating: int | None = Field(default=None, ge=1, le=5)
    leftover_level: Literal["none", "low", "moderate", "high", "unknown"]
    issue_tags: list[str]
    preference_tags: list[str]
    summary: str


class CatererReplyResponse(Stage6Model):
    prompt_version: Literal["caterer_reply_v1"]
    intent: Literal[
        "confirmed",
        "unavailable_item",
        "quantity_question",
        "delivery_question",
        "ingredient_change",
        "ambiguous",
        "other",
    ]
    unavailable_items: list[str]
    proposed_replacements: list[str]
    quantity_question: str | None
    delivery_question: str | None
    ingredient_or_safety_note: str | None
    summary: str


class ExceptionExplanationResponse(Stage6Model):
    prompt_version: Literal["exception_explanation_v1"]
    operator_title: str
    operator_detail: str
    recommended_action: str
    risk_category: Literal[
        "dietary",
        "meal_fit",
        "caterer_reply",
        "quality",
        "email",
        "validation",
        "unknown",
    ]


class ResolutionReplacementMapping(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_item: str
    replacement_item: str


class ExceptionResolutionResponse(Stage6Model):
    prompt_version: Literal["exception_resolution_v1"]
    resolution_type: Literal["revise_and_reply", "reply_only"]
    replacement_mappings: list[ResolutionReplacementMapping]
    removal_requests: list[str]
    response_text: str
    ambiguity_flag: bool
    explanation: str


MODEL_BY_PURPOSE = {
    "dish_tagging": DishTagsResponse,
    "student_feedback": StudentFeedbackResponse,
    "manager_feedback": ManagerFeedbackResponse,
    "caterer_reply": CatererReplyResponse,
    "exception_explanation": ExceptionExplanationResponse,
    "exception_resolution": ExceptionResolutionResponse,
}


def parse_stage6_response(purpose: str, raw_output: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Parse and normalize one Stage 6 response.

    Returns `(parsed_output, metadata)`. Unknown preference tags are replaced
    with `other_for_review` and force review.
    """
    model = MODEL_BY_PURPOSE[purpose]
    try:
        raw_data = _loads_json_object(raw_output)
        raw_data = _normalize_raw_data(purpose, raw_data)
        parsed = model.model_validate(raw_data).model_dump()
        metadata: dict[str, Any] = {
            "validation_mode": "tolerant_provider_neutral",
            "validation_warnings": [],
        }
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        return _fallback_output(purpose, _fallback_summary(purpose)), {
            "validation_mode": "tolerant_provider_neutral",
            "validation_warnings": ["invalid_response"],
            "parse_error": str(exc),
        }

    return _normalize_validated_output(purpose, parsed, metadata)


def parse_stage6_structured_response(
    purpose: str,
    raw_output: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Strictly validate schema-constrained provider output without alias repair."""
    model = MODEL_BY_PURPOSE[purpose]
    raw_data = json.loads(raw_output)
    if not isinstance(raw_data, dict):
        raise ValueError("Structured LLM response must be a JSON object.")
    parsed = model.model_validate(raw_data).model_dump()
    return _normalize_validated_output(
        purpose,
        parsed,
        {
            "validation_mode": "strict_json_schema",
            "validation_warnings": [],
            "local_validation": "passed",
        },
    )


def _normalize_validated_output(
    purpose: str,
    parsed: dict[str, Any],
    metadata: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    unknown_tags: list[str] = []
    if purpose == "dish_tagging":
        for tag in parsed["tags"]:
            tag["code"] = _normalize_preference_tag(tag["code"], unknown_tags)
    elif purpose == "student_feedback":
        for field_name in ("liked_tags", "disliked_tags", "requested_tags"):
            parsed[field_name] = [
                _normalize_preference_tag(tag, unknown_tags) for tag in parsed[field_name]
            ]
        parsed["quality_issues"] = [
            _normalize_allowed_tag(tag, QUALITY_ISSUE_TAGS, unknown_tags)
            for tag in parsed["quality_issues"]
        ]
    elif purpose == "manager_feedback":
        parsed["preference_tags"] = [
            _normalize_preference_tag(tag, unknown_tags) for tag in parsed["preference_tags"]
        ]
        parsed["issue_tags"] = [
            _normalize_allowed_tag(tag, MANAGER_ISSUE_TAGS, unknown_tags)
            for tag in parsed["issue_tags"]
        ]

    if unknown_tags:
        parsed["needs_human_review"] = True
        metadata["validation_warnings"].append("unknown_tags_replaced")
        metadata["unknown_tags"] = sorted(set(unknown_tags))
    return parsed, metadata


def _normalize_raw_data(purpose: str, raw_data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(raw_data)
    if normalized.get("schema_version") is not None:
        normalized["schema_version"] = str(normalized["schema_version"])

    if purpose == "caterer_reply":
        intent_aliases = {
            "item_unavailable": "unavailable_item",
            "unavailable": "unavailable_item",
            "confirmed_order": "confirmed",
        }
        intent = str(normalized.get("intent") or "").strip()
        if intent in intent_aliases:
            normalized["intent"] = intent_aliases[intent]
        if normalized.get("summary") is None and normalized.get("reply_summary") is not None:
            normalized["summary"] = normalized.pop("reply_summary")

    return normalized


def _loads_json_object(raw_output: str) -> dict[str, Any]:
    raw_output = raw_output.strip()
    try:
        value = json.loads(raw_output)
    except json.JSONDecodeError:
        value = json.loads(_extract_json_object_text(raw_output))
    if not isinstance(value, dict):
        raise ValueError("LLM response must be a JSON object.")
    return value


def _extract_json_object_text(raw_output: str) -> str:
    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise json.JSONDecodeError("No JSON object found in LLM response.", raw_output, 0)
    return cleaned[start : end + 1]


def _fallback_summary(purpose: str) -> str:
    if purpose == "caterer_reply":
        return (
            "AI reply parser returned an invalid structured response; operator review is required."
        )
    return "AI parser returned an invalid structured response; operator review is required."


def _normalize_preference_tag(tag: str, unknown_tags: list[str]) -> str:
    return _normalize_allowed_tag(tag, CANONICAL_PREFERENCE_TAGS, unknown_tags)


def _normalize_allowed_tag(tag: str, allowed: set[str], unknown_tags: list[str]) -> str:
    cleaned = str(tag).strip()
    if cleaned in allowed:
        return cleaned
    unknown_tags.append(cleaned)
    return "other_for_review"


def _fallback_output(purpose: str, detail: str) -> dict[str, Any]:
    base = {
        "schema_version": SCHEMA_VERSION,
        "prompt_version": PROMPT_VERSIONS[purpose],
        "confidence": 0.0,
        "needs_human_review": True,
    }
    if purpose == "dish_tagging":
        return {**base, "dish_variant_id": None, "tags": [], "notes": detail}
    if purpose == "student_feedback":
        return {
            **base,
            "sentiment": "unknown",
            "liked_tags": [],
            "disliked_tags": [],
            "requested_tags": ["other_for_review"],
            "requested_food_text": None,
            "quality_issues": ["other_for_review"],
            "summary": detail,
        }
    if purpose == "exception_resolution":
        return {
            **base,
            "resolution_type": "reply_only",
            "replacement_mappings": [],
            "removal_requests": [],
            "response_text": "",
            "ambiguity_flag": True,
            "explanation": detail,
        }
    if purpose == "manager_feedback":
        return {
            **base,
            "delivery_status": "unknown",
            "food_quality_rating": None,
            "leftover_level": "unknown",
            "issue_tags": ["other_for_review"],
            "preference_tags": ["other_for_review"],
            "summary": detail,
        }
    if purpose == "caterer_reply":
        return {
            **base,
            "intent": "ambiguous",
            "unavailable_items": [],
            "proposed_replacements": [],
            "quantity_question": None,
            "delivery_question": None,
            "ingredient_or_safety_note": None,
            "summary": detail,
        }
    return {
        **base,
        "operator_title": "AI interpretation failed",
        "operator_detail": detail,
        "recommended_action": "Review the source text manually.",
        "risk_category": "unknown",
    }
