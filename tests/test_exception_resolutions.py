from __future__ import annotations

import json

from padea_catering.communications.actions import EmailProvider
from padea_catering.exception_resolutions import (
    apply_resolution_preview,
    edit_resolution_preview,
    generate_resolution_preview,
)
from padea_catering.llm import FakeLLMProvider
from tests.test_operations import FakeClient, FakeTable


class FakeEmailProvider(EmailProvider):
    provider_name = "fake"

    def __init__(self) -> None:
        self.sent: list[dict] = []

    def send(self, **kwargs):
        self.sent.append(kwargs)
        return {
            "provider": self.provider_name,
            "requested_recipients": kwargs["to_emails"],
            "actual_recipients": ["test@example.com"],
        }


def _resolution_output(**overrides) -> str:
    payload = {
        "schema_version": "1",
        "prompt_version": "exception_resolution_v1",
        "confidence": 0.94,
        "needs_human_review": False,
        "resolution_type": "revise_and_reply",
        "replacement_mappings": [
            {"source_item": "Chicken Wrap", "replacement_item": "Vegetarian Bowl"},
            {"source_item": "Beef Wrap", "replacement_item": "Vegetarian Bowl"},
        ],
        "removal_requests": [],
        "response_text": "Thanks. We have updated both unavailable items.",
        "ambiguity_flag": False,
        "explanation": "Two current items map to one reviewed replacement.",
    }
    payload.update(overrides)
    return json.dumps(payload)


def _client() -> FakeClient:
    client = FakeClient()
    client.tables["order_runs"].rows = [
        {
            "id": "run-1",
            "status": "approved",
            "service_week_start": "2026-05-01",
            "service_week_end": "2026-05-07",
            "issue_count": 0,
            "input_snapshot": {"source": "test"},
        }
    ]
    client.tables.update(
        {
            "autopilot_exceptions": FakeTable(
                "autopilot_exceptions",
                [
                    {
                        "id": "exception-1",
                        "status": "open",
                        "category": "caterer_reply",
                        "title": "Caterer reply needs review",
                        "detail": "Two items are unavailable.",
                        "recommended_action": "Choose safe replacements.",
                        "caterer_id": "caterer-1",
                        "order_run_id": "run-1",
                        "metadata": {"caterer_reply_id": "reply-1"},
                    }
                ],
            ),
            "caterer_reply_intake": FakeTable(
                "caterer_reply_intake",
                [
                    {
                        "id": "reply-1",
                        "order_run_id": "run-1",
                        "caterer_id": "caterer-1",
                        "communication_id": "initial-communication",
                        "subject": "Re: Padea catering order",
                        "raw_body": "Chicken and beef wraps are unavailable.",
                        "provider_message_id": "<reply@example.com>",
                        "in_reply_to_message_id": "<initial@example.com>",
                        "reference_message_ids": ["<initial@example.com>"],
                        "metadata": {"autopilot_exception_id": "exception-1"},
                    }
                ],
            ),
            "ai_interpretations": FakeTable("ai_interpretations", []),
            "autopilot_exception_resolutions": FakeTable("autopilot_exception_resolutions", []),
            "caterers": FakeTable("caterers", [{"id": "caterer-1", "name": "Example Catering"}]),
            "schools": FakeTable(
                "schools", [{"id": "school-1", "canonical_name": "Example School"}]
            ),
            "sessions": FakeTable(
                "sessions",
                [
                    {
                        "id": "session-1",
                        "caterer_id": "caterer-1",
                        "school_id": "school-1",
                        "session_date": "2026-05-01",
                        "dinner_time": "18:00:00",
                        "building": "Library",
                        "room": None,
                        "manager_name": "Manager",
                        "manager_mobile": "0400000000",
                    }
                ],
            ),
            "dishes": FakeTable(
                "dishes",
                [
                    {"id": "dish-chicken", "caterer_id": "caterer-1", "name": "Chicken Wrap"},
                    {"id": "dish-beef", "caterer_id": "caterer-1", "name": "Beef Wrap"},
                    {
                        "id": "dish-vegetarian",
                        "caterer_id": "caterer-1",
                        "name": "Vegetarian Bowl",
                    },
                ],
            ),
            "dish_variants": FakeTable(
                "dish_variants",
                [
                    _variant("variant-chicken", "dish-chicken"),
                    _variant("variant-beef", "dish-beef"),
                    _variant(
                        "variant-vegetarian",
                        "dish-vegetarian",
                        is_vegetarian_option=True,
                    ),
                ],
            ),
            "order_lines": FakeTable(
                "order_lines",
                [
                    _line("line-chicken", "variant-chicken", "dish-chicken", 2),
                    _line("line-beef", "variant-beef", "dish-beef", 1),
                ],
            ),
            "order_allocations": FakeTable(
                "order_allocations",
                [
                    _allocation("allocation-1", "student-1", "variant-chicken", "dish-chicken"),
                    _allocation("allocation-2", "student-2", "variant-chicken", "dish-chicken"),
                    _allocation("allocation-3", "student-3", "variant-beef", "dish-beef"),
                ],
            ),
            "order_communications": FakeTable(
                "order_communications",
                [
                    {
                        "id": "initial-communication",
                        "order_run_id": "run-1",
                        "caterer_id": "caterer-1",
                        "communication_kind": "order_snapshot",
                        "status": "sent",
                        "outbound_message_id": "<initial@example.com>",
                    }
                ],
            ),
            "order_communication_recipients": FakeTable("order_communication_recipients", []),
            "order_communication_events": FakeTable("order_communication_events", []),
            "caterer_contacts": FakeTable(
                "caterer_contacts",
                [
                    {
                        "id": "contact-1",
                        "caterer_id": "caterer-1",
                        "role": "primary",
                        "display_name": "Caterer",
                        "email": "caterer@example.com",
                        "cc_preference": "to",
                    }
                ],
            ),
            "order_allocation_issues": FakeTable("order_allocation_issues", []),
        }
    )
    return client


def _variant(variant_id: str, dish_id: str, **overrides) -> dict:
    row = {
        "id": variant_id,
        "dish_id": dish_id,
        "name": "Standard",
        "is_default": True,
        "is_available": True,
        "is_gluten_free": True,
        "is_dairy_free": True,
        "is_nut_free": True,
        "is_vegetarian_option": False,
        "is_halal_inferred": True,
        "has_no_declared_tags": False,
        "contains_beef": False,
        "contains_pork": False,
        "contains_red_meat": False,
        "contains_fish": False,
        "contains_shellfish": False,
        "ingredient_flags_source": "operator_reviewed",
    }
    row.update(overrides)
    return row


def _line(line_id: str, variant_id: str, dish_id: str, quantity: int) -> dict:
    return {
        "id": line_id,
        "order_run_id": "run-1",
        "session_id": "session-1",
        "dish_id": dish_id,
        "dish_variant_id": variant_id,
        "quantity": quantity,
        "unit_price_cents": 1200,
        "gst_inclusive": True,
        "line_total_cents": quantity * 1200,
    }


def _allocation(allocation_id: str, student_id: str, variant_id: str, dish_id: str) -> dict:
    return {
        "id": allocation_id,
        "order_run_id": "run-1",
        "student_id": student_id,
        "session_id": "session-1",
        "dish_id": dish_id,
        "dish_variant_id": variant_id,
        "status": "allocated",
        "reason_codes": [],
        "dietary_tag_codes": [],
    }


def test_preview_persists_many_to_one_mapping_without_side_effects() -> None:
    client = _client()

    preview = generate_resolution_preview(
        client,
        exception_id="exception-1",
        operator_instruction="Replace both wraps with the vegetarian bowl.",
        actor_id="operator-1",
        actor_name="Operator",
        idempotency_key="preview-1",
        provider=FakeLLMProvider([_resolution_output()]),
    )

    assert preview["status"] == "ready"
    assert preview["validation_report"]["affected_meal_count"] == 3
    assert len(preview["edited_action"]["mappings"]) == 2
    assert len(client.tables["order_runs"].rows) == 1
    assert len(client.tables["order_communications"].rows) == 1


def test_edit_revalidation_blocks_removal_that_would_drop_student_meals() -> None:
    client = _client()
    preview = generate_resolution_preview(
        client,
        exception_id="exception-1",
        operator_instruction="Prepare a preview.",
        actor_id="operator-1",
        actor_name="Operator",
        idempotency_key="preview-1",
        provider=FakeLLMProvider([_resolution_output()]),
    )

    edited = edit_resolution_preview(
        client,
        resolution_id=preview["id"],
        action={
            "resolution_type": "revise_and_reply",
            "mappings": [],
            "removals": ["variant-chicken"],
        },
        message_text="We removed the item.",
        actor_id="operator-1",
    )

    assert edited["status"] == "draft"
    assert "without a meal" in " ".join(edited["validation_report"]["errors"])


def test_reply_only_apply_sends_once_and_leaves_order_unchanged() -> None:
    client = _client()
    provider = FakeEmailProvider()
    preview = generate_resolution_preview(
        client,
        exception_id="exception-1",
        operator_instruction="Answer that the delivery time remains 6pm.",
        actor_id="operator-1",
        actor_name="Operator",
        idempotency_key="preview-1",
        provider=FakeLLMProvider(
            [
                _resolution_output(
                    resolution_type="reply_only",
                    replacement_mappings=[],
                    response_text="The delivery time remains 6pm.",
                )
            ]
        ),
    )

    first = apply_resolution_preview(
        client,
        resolution_id=preview["id"],
        actor_id="operator-1",
        actor_name="Operator",
        email_provider=provider,
    )
    second = apply_resolution_preview(
        client,
        resolution_id=preview["id"],
        actor_id="operator-1",
        actor_name="Operator",
        email_provider=provider,
    )

    assert first["status"] == second["status"] == "applied"
    assert first["resulting_order_run_id"] is None
    assert len(client.tables["order_runs"].rows) == 1
    assert len(provider.sent) == 1
    replies = [
        row
        for row in client.tables["order_communications"].rows
        if row.get("communication_kind") == "exception_reply"
    ]
    assert len(replies) == 1
    assert replies[0]["in_reply_to_message_id"] == "<reply@example.com>"
    assert client.tables["autopilot_exceptions"].rows[0]["status"] == "resolved"


def test_many_to_one_apply_creates_one_revised_run_and_merged_line() -> None:
    client = _client()
    provider = FakeEmailProvider()
    preview = generate_resolution_preview(
        client,
        exception_id="exception-1",
        operator_instruction="Replace both wraps with the vegetarian bowl.",
        actor_id="operator-1",
        actor_name="Operator",
        idempotency_key="preview-1",
        provider=FakeLLMProvider([_resolution_output()]),
    )

    first = apply_resolution_preview(
        client,
        resolution_id=preview["id"],
        actor_id="operator-1",
        actor_name="Operator",
        email_provider=provider,
    )
    second = apply_resolution_preview(
        client,
        resolution_id=preview["id"],
        actor_id="operator-1",
        actor_name="Operator",
        email_provider=provider,
    )

    assert first["resulting_order_run_id"] == second["resulting_order_run_id"]
    assert len(client.tables["order_runs"].rows) == 2
    revised_lines = [
        row
        for row in client.tables["order_lines"].rows
        if row["order_run_id"] == first["resulting_order_run_id"]
    ]
    assert len(revised_lines) == 1
    assert revised_lines[0]["dish_variant_id"] == "variant-vegetarian"
    assert revised_lines[0]["quantity"] == 3
    assert len(provider.sent) == 1
