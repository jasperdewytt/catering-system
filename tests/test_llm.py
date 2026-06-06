from __future__ import annotations

import json
import sys
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from padea_catering.llm import (
    AnthropicClaudeProvider,
    FakeLLMProvider,
    LLMProviderError,
    explain_autopilot_exception,
    interpret_caterer_reply,
    interpret_dish_variant_tags,
    interpret_manager_feedback,
    interpret_student_feedback,
)
from padea_catering.llm.actions import stable_input_hash
from padea_catering.llm.schemas import (
    CatererReplyResponse,
    parse_stage6_response,
    parse_stage6_structured_response,
)
from tests.test_operations import FakeClient, FakeTable


def _llm_client() -> FakeClient:
    client = FakeClient()
    client.tables.update(
        {
            "ai_interpretations": FakeTable("ai_interpretations", []),
            "dishes": FakeTable(
                "dishes",
                [
                    {
                        "id": "dish-1",
                        "name": "Chicken Burrito",
                        "ingredient_notes": "Mexican wrap with chicken and rice.",
                    }
                ],
            ),
            "dish_variants": FakeTable(
                "dish_variants",
                [{"id": "variant-1", "dish_id": "dish-1", "name": "Standard"}],
            ),
            "student_meal_feedback": FakeTable(
                "student_meal_feedback",
                [
                    {
                        "id": "feedback-1",
                        "rating": 4,
                        "liked": True,
                        "free_text": "Loved the sushi, pasta was too creamy.",
                        "requested_food": "More rice bowls",
                        "source": "student_form",
                    }
                ],
            ),
            "session_catering_feedback": FakeTable(
                "session_catering_feedback",
                [
                    {
                        "id": "manager-feedback-1",
                        "delivery_status": None,
                        "food_quality_rating": None,
                        "leftover_level": None,
                        "issue_tags": [],
                        "manager_notes": "Food was late and there were high leftovers.",
                        "source": "manager_form",
                    }
                ],
            ),
            "caterer_reply_intake": FakeTable(
                "caterer_reply_intake",
                [
                    {
                        "id": "reply-1",
                        "from_email": "caterer@example.com",
                        "subject": "Re: order",
                        "raw_body": "We are out of chicken burritos.",
                        "received_at": "2026-06-05T00:00:00+00:00",
                        "ai_interpretation_id": None,
                    }
                ],
            ),
            "autopilot_exceptions": FakeTable(
                "autopilot_exceptions",
                [
                    {
                        "id": "exception-1",
                        "severity": "blocked",
                        "category": "email",
                        "title": "Email send failed",
                        "detail": "SMTP rejected message.",
                        "recommended_action": "Review provider config.",
                        "metadata": {"provider": "fake"},
                    }
                ],
            ),
            "dish_variant_tags": FakeTable("dish_variant_tags", []),
            "student_preference_signals": FakeTable("student_preference_signals", []),
            "caterer_quality_events": FakeTable("caterer_quality_events", []),
        }
    )
    return client


def _json(data: dict) -> str:
    return json.dumps(data)


VALID_RESPONSES = {
    "dish_tagging": {
        "schema_version": "1",
        "prompt_version": "dish_tags_v1",
        "confidence": 0.92,
        "needs_human_review": False,
        "dish_variant_id": "variant-1",
        "tags": [{"code": "wrap", "confidence": 0.9, "reason": "Burrito format"}],
        "notes": "Mexican handheld food.",
    },
    "student_feedback": {
        "schema_version": "1",
        "prompt_version": "student_feedback_v1",
        "confidence": 0.86,
        "needs_human_review": False,
        "sentiment": "mixed",
        "liked_tags": ["sushi"],
        "disliked_tags": ["creamy"],
        "requested_tags": ["rice"],
        "requested_food_text": "More rice bowls",
        "quality_issues": ["food_quality"],
        "summary": "Likes sushi and rice, dislikes creamy pasta.",
    },
    "manager_feedback": {
        "schema_version": "1",
        "prompt_version": "manager_feedback_v1",
        "confidence": 0.81,
        "needs_human_review": False,
        "delivery_status": "late",
        "food_quality_rating": 3,
        "leftover_level": "high",
        "issue_tags": ["late_delivery", "food_quality"],
        "preference_tags": ["hot_food"],
        "summary": "Late food and leftovers.",
    },
    "caterer_reply": {
        "schema_version": "1",
        "prompt_version": "caterer_reply_v1",
        "confidence": 0.88,
        "needs_human_review": True,
        "intent": "unavailable_item",
        "unavailable_items": ["chicken burritos"],
        "proposed_replacements": ["vegetarian burritos"],
        "quantity_question": None,
        "delivery_question": None,
        "ingredient_or_safety_note": None,
        "summary": "Caterer says chicken burritos are unavailable.",
    },
    "exception_explanation": {
        "schema_version": "1",
        "prompt_version": "exception_explanation_v1",
        "confidence": 0.84,
        "needs_human_review": True,
        "operator_title": "Email provider rejected send",
        "operator_detail": "The configured email provider rejected the message.",
        "recommended_action": "Check SMTP credentials and retry.",
        "risk_category": "email",
    },
}


def test_anthropic_provider_requires_backend_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("PADEA_CLAUDE_MODEL", raising=False)

    with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
        AnthropicClaudeProvider.from_env()


def test_anthropic_provider_maps_common_model_alias(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeAnthropic:
        def __init__(self, *, api_key: str) -> None:
            self.api_key = api_key

    monkeypatch.setitem(sys.modules, "anthropic", SimpleNamespace(Anthropic=FakeAnthropic))

    provider = AnthropicClaudeProvider(api_key="test-key", model="sonnet")

    assert provider.model == "claude-sonnet-4-6"


def test_fake_provider_records_prompts_and_returns_deterministic_response() -> None:
    provider = FakeLLMProvider(["{}"])

    completion = provider.complete(
        system_prompt="system",
        user_prompt="user",
        response_model=CatererReplyResponse,
    )

    assert completion.raw_output == "{}"
    assert completion.structured_output is False
    assert provider.prompts == [{"system_prompt": "system", "user_prompt": "user"}]


def test_anthropic_provider_requests_exact_caterer_reply_json_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[dict] = []

    class FakeMessages:
        def create(self, **kwargs):
            requests.append(kwargs)
            return SimpleNamespace(
                content=[SimpleNamespace(text=_json(VALID_RESPONSES["caterer_reply"]))],
                model="claude-sonnet-4-6",
                stop_reason="end_turn",
            )

    class FakeAnthropic:
        def __init__(self, *, api_key: str) -> None:
            self.messages = FakeMessages()

    monkeypatch.setitem(sys.modules, "anthropic", SimpleNamespace(Anthropic=FakeAnthropic))
    provider = AnthropicClaudeProvider(api_key="test-key", model="sonnet")

    completion = provider.complete(
        system_prompt="system",
        user_prompt="user",
        response_model=CatererReplyResponse,
    )

    schema = requests[0]["output_config"]["format"]["schema"]
    assert requests[0]["output_config"]["format"]["type"] == "json_schema"
    assert schema["additionalProperties"] is False
    assert "minimum" not in schema["properties"]["confidence"]
    assert "maximum" not in schema["properties"]["confidence"]
    assert schema["properties"]["intent"]["enum"] == [
        "confirmed",
        "unavailable_item",
        "quantity_question",
        "delivery_question",
        "ingredient_change",
        "ambiguous",
        "other",
    ]
    assert schema["properties"]["unavailable_items"]["items"] == {"type": "string"}
    assert completion.metadata["stop_reason"] == "end_turn"


def test_anthropic_provider_rejects_interrupted_structured_generation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeMessages:
        def create(self, **kwargs):
            return SimpleNamespace(
                content=[SimpleNamespace(text="{}")],
                model="claude-sonnet-4-6",
                stop_reason="max_tokens",
            )

    class FakeAnthropic:
        def __init__(self, *, api_key: str) -> None:
            self.messages = FakeMessages()

    monkeypatch.setitem(sys.modules, "anthropic", SimpleNamespace(Anthropic=FakeAnthropic))
    provider = AnthropicClaudeProvider(api_key="test-key", model="sonnet")

    with pytest.raises(LLMProviderError, match="max_tokens"):
        provider.complete(
            system_prompt="system",
            user_prompt="user",
            response_model=CatererReplyResponse,
        )


def test_strict_structured_reply_rejects_nested_unavailable_items() -> None:
    invalid = {
        **VALID_RESPONSES["caterer_reply"],
        "unavailable_items": [{"name": "Chicken burrito"}],
    }

    with pytest.raises(ValidationError):
        parse_stage6_structured_response("caterer_reply", _json(invalid))


def test_stable_input_hash_includes_prompt_version_and_input() -> None:
    first = stable_input_hash(prompt_version="student_feedback_v1", raw_input={"text": "a"})
    same = stable_input_hash(prompt_version="student_feedback_v1", raw_input={"text": "a"})
    changed_version = stable_input_hash(
        prompt_version="student_feedback_v2", raw_input={"text": "a"}
    )
    changed_input = stable_input_hash(prompt_version="student_feedback_v1", raw_input={"text": "b"})

    assert first == same
    assert first != changed_version
    assert first != changed_input


@pytest.mark.parametrize("purpose", list(VALID_RESPONSES))
def test_valid_frozen_json_contracts_parse(purpose: str) -> None:
    parsed, metadata = parse_stage6_response(purpose, _json(VALID_RESPONSES[purpose]))

    assert parsed["schema_version"] == "1"
    assert parsed["prompt_version"] == VALID_RESPONSES[purpose]["prompt_version"]
    assert parsed["confidence"] == VALID_RESPONSES[purpose]["confidence"]
    assert metadata["validation_warnings"] == []


def test_malformed_json_becomes_review_required_fallback() -> None:
    parsed, metadata = parse_stage6_response("caterer_reply", "{not json")

    assert parsed["prompt_version"] == "caterer_reply_v1"
    assert parsed["confidence"] == 0.0
    assert parsed["needs_human_review"] is True
    assert parsed["intent"] == "ambiguous"
    assert (
        parsed["summary"]
        == "AI reply parser returned an invalid structured response; operator review is required."
    )
    assert "invalid_response" in metadata["validation_warnings"]
    assert "parse_error" in metadata


def test_markdown_wrapped_json_response_is_parsed() -> None:
    parsed, metadata = parse_stage6_response(
        "caterer_reply",
        "```json\n" + _json(VALID_RESPONSES["caterer_reply"]) + "\n```",
    )

    assert parsed["intent"] == "unavailable_item"
    assert parsed["summary"] == "Caterer says chicken burritos are unavailable."
    assert metadata["validation_warnings"] == []


def test_common_caterer_reply_aliases_are_normalized_before_validation() -> None:
    raw = {
        **VALID_RESPONSES["caterer_reply"],
        "schema_version": 1,
        "intent": "item_unavailable",
        "summary": None,
        "reply_summary": "Caterer says breakfast tacos are unavailable.",
    }

    parsed, metadata = parse_stage6_response("caterer_reply", _json(raw))

    assert parsed["schema_version"] == "1"
    assert parsed["intent"] == "unavailable_item"
    assert parsed["summary"] == "Caterer says breakfast tacos are unavailable."
    assert metadata["validation_warnings"] == []


def test_unknown_preference_tags_are_replaced_and_force_review() -> None:
    raw = {
        **VALID_RESPONSES["student_feedback"],
        "liked_tags": ["totally_new_tag"],
        "requested_tags": ["rice"],
    }

    parsed, metadata = parse_stage6_response("student_feedback", _json(raw))

    assert parsed["liked_tags"] == ["other_for_review"]
    assert parsed["requested_tags"] == ["rice"]
    assert parsed["needs_human_review"] is True
    assert metadata["unknown_tags"] == ["totally_new_tag"]


def test_interpretation_actions_persist_rows_and_do_not_materialize_domain_tables() -> None:
    client = _llm_client()
    provider = FakeLLMProvider(
        [
            _json(VALID_RESPONSES["dish_tagging"]),
            _json(VALID_RESPONSES["student_feedback"]),
            _json(VALID_RESPONSES["manager_feedback"]),
            _json(VALID_RESPONSES["caterer_reply"]),
            _json(VALID_RESPONSES["exception_explanation"]),
        ]
    )

    dish_ai = interpret_dish_variant_tags(client, "variant-1", provider=provider)
    student_ai = interpret_student_feedback(client, "feedback-1", provider=provider)
    manager_ai = interpret_manager_feedback(client, "manager-feedback-1", provider=provider)
    reply_ai = interpret_caterer_reply(client, "reply-1", provider=provider)
    exception_ai = explain_autopilot_exception(client, "exception-1", provider=provider)

    assert [row["purpose"] for row in client.tables["ai_interpretations"].rows] == [
        "dish_tagging",
        "student_feedback",
        "manager_feedback",
        "caterer_reply",
        "exception_explanation",
    ]
    assert dish_ai["parsed_output"]["tags"][0]["code"] == "wrap"
    assert student_ai["student_meal_feedback_id"] == "feedback-1"
    assert manager_ai["session_catering_feedback_id"] == "manager-feedback-1"
    assert reply_ai["caterer_reply_id"] == "reply-1"
    assert exception_ai["autopilot_exception_id"] == "exception-1"
    assert client.tables["caterer_reply_intake"].rows[0]["ai_interpretation_id"] == reply_ai["id"]

    assert client.tables["dish_variant_tags"].rows == []
    assert client.tables["student_preference_signals"].rows == []
    assert client.tables["session_catering_feedback"].rows[0]["manager_notes"].startswith("Food")
    assert client.tables["caterer_quality_events"].rows == []


def test_invalid_provider_output_still_persists_ai_provenance() -> None:
    client = _llm_client()
    provider = FakeLLMProvider(["not json"])

    result = interpret_student_feedback(client, "feedback-1", provider=provider)

    assert result["purpose"] == "student_feedback"
    assert result["raw_output"] == "not json"
    assert result["parsed_output"]["needs_human_review"] is True
    assert result["metadata"]["validation_warnings"] == ["invalid_response"]
