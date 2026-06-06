from __future__ import annotations

import json
from email.message import EmailMessage

import pytest

from padea_catering.communications import send_caterer_emails as real_send_caterer_emails
from padea_catering.communications.actions import EmailProvider
from padea_catering.llm import FakeLLMProvider
from padea_catering.replies import handle_caterer_reply, record_and_handle_caterer_reply
from padea_catering.replies import handler as reply_handler
from padea_catering.replies import imap as reply_imap
from padea_catering.replies.__main__ import build_parser, main
from padea_catering.replies.handler import INTENT_TO_DB
from tests.test_operations import FakeClient, FakeTable


def _reply_client() -> FakeClient:
    client = FakeClient()
    client.tables.update(
        {
            "order_runs": FakeTable(
                "order_runs",
                [
                    {
                        "id": "run-1",
                        "status": "approved",
                        "service_week_start": "2026-05-01",
                    }
                ],
            ),
            "caterer_reply_intake": FakeTable("caterer_reply_intake", []),
            "ai_interpretations": FakeTable("ai_interpretations", []),
            "autopilot_exceptions": FakeTable("autopilot_exceptions", []),
            "autopilot_runs": FakeTable(
                "autopilot_runs",
                [
                    {
                        "id": "autopilot-1",
                        "generated_order_run_id": "run-1",
                        "service_week_start": "2026-05-01",
                    }
                ],
            ),
            "meal_fit_scoring_versions": FakeTable(
                "meal_fit_scoring_versions",
                [
                    {
                        "id": "score-1",
                        "version": "meal_fit_v1",
                        "is_active": True,
                        "weights": {},
                        "decay_config": {"minimum_ai_auto_handle_confidence": 0.80},
                    }
                ],
            ),
            "order_lines": FakeTable("order_lines", [{"id": "line-1", "quantity": 10}]),
            "order_communications": FakeTable(
                "order_communications",
                [{"id": "communication-1", "status": "sent"}],
            ),
        }
    )
    return client


def _llm_reply(**overrides) -> str:
    payload = {
        "schema_version": "1",
        "prompt_version": "caterer_reply_v1",
        "confidence": 0.91,
        "needs_human_review": False,
        "intent": "confirmed",
        "unavailable_items": [],
        "proposed_replacements": [],
        "quantity_question": None,
        "delivery_question": None,
        "ingredient_or_safety_note": None,
        "summary": "Caterer confirmed the order.",
    }
    payload.update(overrides)
    return json.dumps(payload)


def test_reply_summary_is_not_truncated_before_persistence() -> None:
    client = _reply_client()
    summary = "Complete interpreted summary " + ("with operational detail " * 30)

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="Confirmed.",
        provider=FakeLLMProvider([_llm_reply(summary=summary)]),
    )

    assert result["summary"] == " ".join(summary.split())
    assert not result["summary"].endswith("...")


class FakeEmailProvider(EmailProvider):
    provider_name = "fake"

    def __init__(self) -> None:
        self.sent_messages: list[dict[str, object]] = []

    def send(
        self,
        *,
        subject: str,
        body: str,
        to_emails: list[str],
        message_id: str | None = None,
        in_reply_to: str | None = None,
        references: list[str] | None = None,
    ) -> dict[str, object]:
        self.sent_messages.append(
            {
                "subject": subject,
                "body": body,
                "message_id": message_id,
                "in_reply_to": in_reply_to,
                "references": references or [],
            }
        )
        return {
            "provider": self.provider_name,
            "subject": subject,
            "requested_recipients": to_emails,
            "actual_recipients": ["test@example.com"],
        }


def _revision_client() -> FakeClient:
    client = FakeClient()
    client.tables["order_runs"].rows[0].update(
        {
            "status": "approved",
            "service_week_start": "2026-05-01",
            "service_week_end": "2026-05-07",
            "algorithm_version": "meal_fit_v1",
            "input_snapshot": {"source": "test"},
            "issue_count": 0,
            "approved_at": "2026-05-01T00:00:00+00:00",
            "approved_by": "Operator",
            "approval_note": "Approved",
        }
    )
    client.tables.update(
        {
            "caterers": FakeTable(
                "caterers",
                [
                    {"id": "caterer-1", "name": "Burrito Co"},
                    {"id": "caterer-2", "name": "Pizza Co"},
                ],
            ),
            "schools": FakeTable(
                "schools",
                [{"id": "school-1", "canonical_name": "Example School"}],
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
                        "manager_name": "Jessie",
                        "manager_mobile": "0412 345 678",
                    },
                    {
                        "id": "session-2",
                        "caterer_id": "caterer-2",
                        "school_id": "school-1",
                        "session_date": "2026-05-01",
                        "dinner_time": "18:00:00",
                        "building": "Hall",
                        "room": None,
                        "manager_name": "Jessie",
                        "manager_mobile": "0412 345 678",
                    },
                ],
            ),
            "dishes": FakeTable(
                "dishes",
                [
                    {"id": "dish-chicken", "caterer_id": "caterer-1", "name": "Chicken burrito"},
                    {
                        "id": "dish-veg",
                        "caterer_id": "caterer-1",
                        "name": "Vegetarian burrito",
                    },
                    {"id": "dish-rice", "caterer_id": "caterer-1", "name": "Rice bowl"},
                    {"id": "dish-nut", "caterer_id": "caterer-1", "name": "Satay bowl"},
                    {"id": "dish-pizza", "caterer_id": "caterer-2", "name": "Pizza"},
                ],
            ),
            "dish_variants": FakeTable(
                "dish_variants",
                [
                    {
                        "id": "variant-chicken",
                        "dish_id": "dish-chicken",
                        "name": "Standard",
                        "is_available": True,
                        "ingredient_flags_source": "operator_reviewed",
                        "is_nut_free": True,
                        "is_gluten_free": False,
                        "is_dairy_free": False,
                        "is_vegetarian_option": False,
                        "is_halal_inferred": False,
                    },
                    {
                        "id": "variant-chicken-spicy",
                        "dish_id": "dish-chicken",
                        "name": "Spicy",
                        "is_available": True,
                        "ingredient_flags_source": "operator_reviewed",
                        "is_nut_free": True,
                        "is_gluten_free": False,
                        "is_dairy_free": False,
                        "is_vegetarian_option": False,
                        "is_halal_inferred": False,
                    },
                    {
                        "id": "variant-veg",
                        "dish_id": "dish-veg",
                        "name": "Standard",
                        "is_available": True,
                        "ingredient_flags_source": "operator_reviewed",
                        "is_nut_free": True,
                        "is_gluten_free": False,
                        "is_dairy_free": False,
                        "is_vegetarian_option": True,
                        "is_halal_inferred": False,
                    },
                    {
                        "id": "variant-rice",
                        "dish_id": "dish-rice",
                        "name": "Standard",
                        "is_available": True,
                        "ingredient_flags_source": "operator_reviewed",
                        "is_nut_free": True,
                        "is_gluten_free": False,
                        "is_dairy_free": False,
                        "is_vegetarian_option": False,
                        "is_halal_inferred": False,
                    },
                    {
                        "id": "variant-nut",
                        "dish_id": "dish-nut",
                        "name": "Standard",
                        "is_available": True,
                        "ingredient_flags_source": "operator_reviewed",
                        "is_nut_free": False,
                        "is_gluten_free": False,
                        "is_dairy_free": False,
                        "is_vegetarian_option": True,
                        "is_halal_inferred": False,
                    },
                    {
                        "id": "variant-pizza",
                        "dish_id": "dish-pizza",
                        "name": "Standard",
                        "is_available": True,
                        "ingredient_flags_source": "operator_reviewed",
                        "is_nut_free": True,
                        "is_gluten_free": False,
                        "is_dairy_free": False,
                        "is_vegetarian_option": False,
                        "is_halal_inferred": False,
                    },
                ],
            ),
            "preference_tags": FakeTable(
                "preference_tags",
                [
                    {"code": "rice", "is_active": True},
                    {"code": "vegetarian_style", "is_active": True},
                    {"code": "wrap", "is_active": True},
                ],
            ),
            "dish_variant_tags": FakeTable(
                "dish_variant_tags",
                [
                    {
                        "dish_variant_id": "variant-chicken-spicy",
                        "tag_code": "wrap",
                        "tag_source": "operator",
                        "confidence": 1.0,
                    },
                    {
                        "dish_variant_id": "variant-veg",
                        "tag_code": "vegetarian_style",
                        "tag_source": "operator",
                        "confidence": 1.0,
                    },
                    {
                        "dish_variant_id": "variant-rice",
                        "tag_code": "rice",
                        "tag_source": "operator",
                        "confidence": 1.0,
                    },
                    {
                        "dish_variant_id": "variant-nut",
                        "tag_code": "vegetarian_style",
                        "tag_source": "operator",
                        "confidence": 1.0,
                    },
                ],
            ),
            "student_preference_signals": FakeTable(
                "student_preference_signals",
                [
                    {
                        "student_id": "student-1",
                        "tag_code": "rice",
                        "affinity_score": 1.0,
                        "confidence": 1.0,
                        "feedback_count": 4,
                    },
                    {
                        "student_id": "student-2",
                        "tag_code": "rice",
                        "affinity_score": 1.0,
                        "confidence": 1.0,
                        "feedback_count": 4,
                    },
                    {
                        "student_id": "student-1",
                        "tag_code": "vegetarian_style",
                        "affinity_score": 0.2,
                        "confidence": 1.0,
                        "feedback_count": 4,
                    },
                    {
                        "student_id": "student-2",
                        "tag_code": "vegetarian_style",
                        "affinity_score": 0.2,
                        "confidence": 1.0,
                        "feedback_count": 4,
                    },
                ],
            ),
            "student_meal_feedback": FakeTable("student_meal_feedback", []),
            "student_fit_debt": FakeTable("student_fit_debt", []),
            "caterer_quality_events": FakeTable("caterer_quality_events", []),
            "session_catering_feedback": FakeTable("session_catering_feedback", []),
            "order_lines": FakeTable(
                "order_lines",
                [
                    {
                        "id": "line-1",
                        "order_run_id": "run-1",
                        "session_id": "session-1",
                        "dish_id": "dish-chicken",
                        "dish_variant_id": "variant-chicken",
                        "quantity": 2,
                        "unit_price_cents": 1200,
                        "gst_inclusive": True,
                        "line_total_cents": 2400,
                    },
                    {
                        "id": "line-2",
                        "order_run_id": "run-1",
                        "session_id": "session-2",
                        "dish_id": "dish-pizza",
                        "dish_variant_id": "variant-pizza",
                        "quantity": 1,
                        "unit_price_cents": 1000,
                        "gst_inclusive": True,
                        "line_total_cents": 1000,
                    },
                ],
            ),
            "order_allocations": FakeTable(
                "order_allocations",
                [
                    {
                        "id": "alloc-1",
                        "order_run_id": "run-1",
                        "session_id": "session-1",
                        "student_id": "student-1",
                        "dish_id": "dish-chicken",
                        "dish_variant_id": "variant-chicken",
                        "status": "allocated",
                        "reason_codes": [],
                        "dietary_tag_codes": [],
                    },
                    {
                        "id": "alloc-2",
                        "order_run_id": "run-1",
                        "session_id": "session-1",
                        "student_id": "student-2",
                        "dish_id": "dish-chicken",
                        "dish_variant_id": "variant-chicken",
                        "status": "allocated",
                        "reason_codes": [],
                        "dietary_tag_codes": [],
                    },
                    {
                        "id": "alloc-3",
                        "order_run_id": "run-1",
                        "session_id": "session-2",
                        "student_id": "student-3",
                        "dish_id": "dish-pizza",
                        "dish_variant_id": "variant-pizza",
                        "status": "allocated",
                        "reason_codes": [],
                        "dietary_tag_codes": [],
                    },
                ],
            ),
            "order_allocation_issues": FakeTable("order_allocation_issues", []),
            "order_communications": FakeTable(
                "order_communications",
                [
                    {
                        "id": "communication-original-1",
                        "order_run_id": "run-1",
                        "caterer_id": "caterer-1",
                        "status": "sent",
                        "subject": "Padea catering order - Burrito Co [Padea:run-1:caterer-1]",
                        "outbound_message_id": "<initial-burrito@padea.example>",
                        "in_reply_to_message_id": None,
                        "reference_message_ids": [],
                    },
                    {
                        "id": "communication-original-2",
                        "order_run_id": "run-1",
                        "caterer_id": "caterer-2",
                        "status": "sent",
                        "subject": "Padea catering order - Pizza Co [Padea:run-1:caterer-2]",
                        "outbound_message_id": "<initial-pizza@padea.example>",
                        "in_reply_to_message_id": None,
                        "reference_message_ids": [],
                    },
                ],
            ),
            "order_communication_recipients": FakeTable(
                "order_communication_recipients",
                [
                    {
                        "id": "recipient-1",
                        "communication_id": "communication-original-1",
                        "email": "burrito@example.com",
                        "recipient_type": "to",
                    },
                    {
                        "id": "recipient-2",
                        "communication_id": "communication-original-2",
                        "email": "pizza@example.com",
                        "recipient_type": "to",
                    },
                ],
            ),
            "order_communication_events": FakeTable("order_communication_events", []),
            "caterer_contacts": FakeTable(
                "caterer_contacts",
                [
                    {
                        "id": "contact-1",
                        "caterer_id": "caterer-1",
                        "role": "primary",
                        "display_name": "Burrito Contact",
                        "email": "burrito@example.com",
                        "cc_preference": "to",
                    }
                ],
            ),
            "caterer_reply_intake": FakeTable("caterer_reply_intake", []),
            "ai_interpretations": FakeTable("ai_interpretations", []),
            "autopilot_exceptions": FakeTable("autopilot_exceptions", []),
            "autopilot_runs": FakeTable(
                "autopilot_runs",
                [{"id": "autopilot-1", "generated_order_run_id": "run-1"}],
            ),
            "meal_fit_scoring_versions": FakeTable(
                "meal_fit_scoring_versions",
                [
                    {
                        "id": "score-1",
                        "version": "meal_fit_v1",
                        "is_active": True,
                        "weights": {},
                        "decay_config": {"minimum_ai_auto_handle_confidence": 0.80},
                    }
                ],
            ),
        }
    )
    return client


def test_clean_high_confidence_confirmation_is_auto_handled_without_exception() -> None:
    client = _reply_client()
    provider = FakeLLMProvider([_llm_reply(confidence=0.90)])

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="Confirmed, thanks.",
        subject="Re: order",
        actor_name="Autopilot",
        provider=provider,
    )

    assert result["parsed_intent"] == "confirmation"
    assert result["handled_status"] == "auto_handled"
    assert result["exception_id"] is None
    assert len(client.tables["ai_interpretations"].rows) == 1
    assert client.tables["autopilot_exceptions"].rows == []
    assert client.tables["audit_log"].rows[0]["action"] == "caterer_reply_received"


def test_low_confidence_confirmation_escalates_for_review() -> None:
    client = _reply_client()
    provider = FakeLLMProvider([_llm_reply(confidence=0.70)])

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="Looks okay I think.",
        provider=provider,
    )

    assert result["parsed_intent"] == "confirmation"
    assert result["handled_status"] == "escalated"
    assert result["exception"]["severity"] == "review"
    assert result["exception"]["category"] == "caterer_reply"


def test_unavailable_item_escalates_and_does_not_mutate_order_facts() -> None:
    client = _reply_client()
    before_runs = [row.copy() for row in client.tables["order_runs"].rows]
    before_lines = [row.copy() for row in client.tables["order_lines"].rows]
    before_communications = [row.copy() for row in client.tables["order_communications"].rows]
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.92,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=["Vegetarian burrito"],
                summary="Caterer says chicken burrito is unavailable.",
            )
        ]
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="We are out of chicken burritos. Veg burritos instead?",
        provider=provider,
    )

    assert result["parsed_intent"] == "item_unavailable"
    assert result["handled_status"] == "escalated"
    assert result["exception"]["severity"] == "blocked"
    assert client.tables["order_runs"].rows == before_runs
    assert client.tables["order_lines"].rows == before_lines
    assert client.tables["order_communications"].rows == before_communications


def test_known_safe_replacement_creates_revised_run_and_sends_affected_caterer_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=["Vegetarian burrito"],
                summary="Caterer can replace chicken burritos with vegetarian burritos.",
            )
        ]
    )
    email_provider = FakeEmailProvider()
    monkeypatch.setattr(
        reply_handler,
        "send_caterer_emails",
        lambda client_arg, **kwargs: real_send_caterer_emails(
            client_arg,
            **kwargs,
            provider=email_provider,
        ),
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        communication_id="communication-original-1",
        raw_body="We are out of chicken burritos. Vegetarian burritos are available.",
        provider_message_id="<caterer-reply-1@example.com>",
        in_reply_to_message_id="<initial-burrito@padea.example>",
        reference_message_ids=[
            "<initial-burrito@padea.example>",
            "<initial-burrito@padea.example>",
        ],
        provider=provider,
    )

    revised_run = client.tables["order_runs"].rows[-1]
    revised_lines = [
        row for row in client.tables["order_lines"].rows if row["order_run_id"] == revised_run["id"]
    ]
    revised_allocations = [
        row
        for row in client.tables["order_allocations"].rows
        if row["order_run_id"] == revised_run["id"]
    ]
    revised_communications = [
        row
        for row in client.tables["order_communications"].rows
        if row.get("order_run_id") == revised_run["id"]
    ]

    assert result["handled_status"] == "auto_adjusted"
    assert revised_run["status"] == "approved"
    assert revised_run["input_snapshot"]["parent_order_run_id"] == "run-1"
    assert revised_run["input_snapshot"]["reply_revision"]["to_variant_id"] == "variant-veg"
    assert {row["caterer_id"] for row in revised_communications} == {"caterer-1"}
    assert revised_communications[0]["status"] == "sent"
    assert revised_communications[0]["subject"] == (
        "Re: Padea catering order - Burrito Co - Week of 1 May 2026"
    )
    assert revised_communications[0]["in_reply_to_message_id"] == ("<caterer-reply-1@example.com>")
    assert revised_communications[0]["reference_message_ids"] == [
        "<initial-burrito@padea.example>",
        "<caterer-reply-1@example.com>",
    ]
    assert revised_communications[0]["body"].startswith(
        "Thanks for letting us know — we've updated the order accordingly.\n"
        "Chicken burrito → Vegetarian burrito\n\n"
        "Here's the full revised order:"
    )
    assert "Total meals: 2" in revised_communications[0]["body"]
    assert email_provider.sent_messages[0]["in_reply_to"] == ("<caterer-reply-1@example.com>")
    assert email_provider.sent_messages[0]["references"] == [
        "<initial-burrito@padea.example>",
        "<caterer-reply-1@example.com>",
    ]
    assert all(row["caterer_id"] != "caterer-2" for row in revised_communications)
    assert [
        (row["session_id"], row["dish_variant_id"], row["quantity"]) for row in revised_lines
    ] == [
        ("session-1", "variant-veg", 2),
        ("session-2", "variant-pizza", 1),
    ]
    assert [
        row["dish_variant_id"] for row in revised_allocations if row["session_id"] == "session-1"
    ] == ["variant-veg", "variant-veg"]
    assert client.tables["audit_log"].rows[-3]["action"] == "order_run_revised"
    assert len(client.tables["order_communications"].rows) == 3


def test_unavailable_item_without_replacement_infers_best_safe_meal_fit_replacement(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=[],
                summary="Caterer says chicken burritos are unavailable.",
            )
        ]
    )
    monkeypatch.setattr(
        reply_handler,
        "send_caterer_emails",
        lambda client_arg, **kwargs: real_send_caterer_emails(
            client_arg,
            **kwargs,
            provider=FakeEmailProvider(),
        ),
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        communication_id="communication-original-1",
        raw_body="We are out of chicken burritos.",
        provider=provider,
    )

    revised_run = client.tables["order_runs"].rows[-1]
    revised_lines = [
        row for row in client.tables["order_lines"].rows if row["order_run_id"] == revised_run["id"]
    ]
    selection = revised_run["input_snapshot"]["reply_revision"]["replacement_selection"]

    assert result["handled_status"] == "auto_adjusted"
    assert result["reply"]["metadata"]["replacement"]["selection_source"] == "meal_fit_inferred"
    assert revised_run["input_snapshot"]["reply_revision"]["to_variant_id"] == "variant-rice"
    assert selection["source"] == "meal_fit_inferred"
    assert "variant-chicken-spicy" not in {
        row["variant_id"] for row in selection["candidate_scores"]
    }
    assert [
        (row["session_id"], row["dish_variant_id"], row["quantity"]) for row in revised_lines
    ] == [
        ("session-1", "variant-rice", 2),
        ("session-2", "variant-pizza", 1),
    ]


def test_variant_specific_unavailable_item_does_not_match_base_dish_variants(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    client.tables["order_lines"].rows.append(
        {
            "id": "line-spicy",
            "order_run_id": "run-1",
            "session_id": "session-1",
            "dish_id": "dish-chicken",
            "dish_variant_id": "variant-chicken-spicy",
            "quantity": 1,
            "unit_price_cents": 1200,
            "gst_inclusive": True,
            "line_total_cents": 1200,
        }
    )
    client.tables["order_allocations"].rows.append(
        {
            "id": "alloc-spicy",
            "order_run_id": "run-1",
            "session_id": "session-1",
            "student_id": "student-spicy",
            "dish_id": "dish-chicken",
            "dish_variant_id": "variant-chicken-spicy",
            "status": "allocated",
            "reason_codes": [],
            "dietary_tag_codes": [],
        }
    )
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito - Spicy"],
                proposed_replacements=[],
                summary="Caterer says spicy chicken burritos are unavailable.",
            )
        ]
    )
    monkeypatch.setattr(
        reply_handler,
        "send_caterer_emails",
        lambda client_arg, **kwargs: real_send_caterer_emails(
            client_arg,
            **kwargs,
            provider=FakeEmailProvider(),
        ),
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        communication_id="communication-original-1",
        raw_body="We are out of spicy chicken burritos.",
        provider=provider,
    )

    revised_run = client.tables["order_runs"].rows[-1]
    revised_lines = [
        row for row in client.tables["order_lines"].rows if row["order_run_id"] == revised_run["id"]
    ]

    assert result["handled_status"] == "auto_adjusted"
    assert revised_run["input_snapshot"]["reply_revision"]["from_variant_id"] == (
        "variant-chicken-spicy"
    )
    assert {
        (row["dish_variant_id"], row["quantity"])
        for row in revised_lines
        if row["session_id"] == "session-1"
    } == {
        ("variant-chicken", 2),
        ("variant-veg", 1),
    }


def test_inferred_replacement_respects_affected_student_dietary_tags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    for allocation in client.tables["order_allocations"].rows:
        if allocation["session_id"] == "session-1":
            allocation["dietary_tag_codes"] = ["vegetarian"]
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=[],
                summary="Caterer says chicken burritos are unavailable.",
            )
        ]
    )
    monkeypatch.setattr(
        reply_handler,
        "send_caterer_emails",
        lambda client_arg, **kwargs: real_send_caterer_emails(
            client_arg,
            **kwargs,
            provider=FakeEmailProvider(),
        ),
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        communication_id="communication-original-1",
        raw_body="We are out of chicken burritos.",
        provider=provider,
    )

    revised_run = client.tables["order_runs"].rows[-1]
    revised_allocations = [
        row
        for row in client.tables["order_allocations"].rows
        if row["order_run_id"] == revised_run["id"] and row["session_id"] == "session-1"
    ]

    assert result["handled_status"] == "auto_adjusted"
    assert revised_run["input_snapshot"]["reply_revision"]["to_variant_id"] == "variant-veg"
    assert {row["dish_variant_id"] for row in revised_allocations} == {"variant-veg"}


def test_inferred_replacement_loads_preferences_for_affected_students_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    client.tables["student_preference_signals"].rows = [
        {
            "student_id": f"unrelated-{index}",
            "tag_code": "rice",
            "affinity_score": -1.0,
            "confidence": 1.0,
            "feedback_count": 4,
        }
        for index in range(1001)
    ] + [
        {
            "student_id": student_id,
            "tag_code": "vegetarian_style",
            "affinity_score": 1.0,
            "confidence": 1.0,
            "feedback_count": 4,
        }
        for student_id in ("student-1", "student-2")
    ]
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=[],
                summary="Caterer says chicken burritos are unavailable.",
            )
        ]
    )
    monkeypatch.setattr(
        reply_handler,
        "send_caterer_emails",
        lambda client_arg, **kwargs: real_send_caterer_emails(
            client_arg,
            **kwargs,
            provider=FakeEmailProvider(),
        ),
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        communication_id="communication-original-1",
        raw_body="We are out of chicken burritos.",
        provider=provider,
    )

    revised_run = client.tables["order_runs"].rows[-1]
    assert result["handled_status"] == "auto_adjusted"
    assert revised_run["input_snapshot"]["reply_revision"]["to_variant_id"] == "variant-veg"


def test_inferred_replacement_escalates_when_no_single_candidate_is_safe() -> None:
    client = _revision_client()
    for allocation in client.tables["order_allocations"].rows:
        if allocation["session_id"] == "session-1":
            allocation["dietary_tag_codes"] = ["vegetarian", "nut_free"]
    for variant in client.tables["dish_variants"].rows:
        if variant["id"] == "variant-veg":
            variant["is_available"] = False
    before_runs = [row.copy() for row in client.tables["order_runs"].rows]
    before_lines = [row.copy() for row in client.tables["order_lines"].rows]
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=[],
                summary="Caterer says chicken burritos are unavailable.",
            )
        ]
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        communication_id="communication-original-1",
        raw_body="We are out of chicken burritos.",
        provider=provider,
    )

    assert result["handled_status"] == "escalated"
    assert result["exception"]["severity"] == "blocked"
    assert result["reply"]["metadata"]["deterministic_block_reason"] == (
        "No safe reviewed same-caterer replacement candidate was found."
    )
    assert "Deterministic revision blocked" in result["exception"]["detail"]
    assert client.tables["order_runs"].rows == before_runs
    assert client.tables["order_lines"].rows == before_lines


def test_reply_revision_retry_resumes_partially_created_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=[],
                summary="Caterer says chicken burritos are unavailable.",
            )
        ]
    )
    monkeypatch.setattr(
        reply_handler,
        "send_caterer_emails",
        lambda client_arg, **kwargs: real_send_caterer_emails(
            client_arg,
            **kwargs,
            provider=FakeEmailProvider(),
        ),
    )
    real_insert_audit = reply_handler._insert_audit_log
    failed_once = False

    def fail_revision_audit_once(client_arg, **kwargs):
        nonlocal failed_once
        if kwargs["action"] == "order_run_revised" and not failed_once:
            failed_once = True
            raise RuntimeError("audit constraint rejected order_run_revised")
        return real_insert_audit(client_arg, **kwargs)

    monkeypatch.setattr(reply_handler, "_insert_audit_log", fail_revision_audit_once)
    with pytest.raises(RuntimeError, match="audit constraint"):
        record_and_handle_caterer_reply(
            client,
            order_run_id="run-1",
            caterer_id="caterer-1",
            communication_id="communication-original-1",
            raw_body="We are out of chicken burritos.",
            provider_message_id="<partial-revision@example.com>",
            provider=provider,
        )

    partial_runs = [
        row
        for row in client.tables["order_runs"].rows
        if row.get("algorithm_version") == "reply-revision-v1"
    ]
    partial_allocations = [
        row
        for row in client.tables["order_allocations"].rows
        if row["order_run_id"] == partial_runs[0]["id"]
    ]
    monkeypatch.setattr(reply_handler, "_insert_audit_log", real_insert_audit)

    result = handle_caterer_reply(client, client.tables["caterer_reply_intake"].rows[-1]["id"])

    revised_runs = [
        row
        for row in client.tables["order_runs"].rows
        if row.get("algorithm_version") == "reply-revision-v1"
    ]
    revised_allocations = [
        row
        for row in client.tables["order_allocations"].rows
        if row["order_run_id"] == revised_runs[0]["id"]
    ]
    assert result["handled_status"] == "auto_adjusted"
    assert len(revised_runs) == 1
    assert len(revised_allocations) == len(partial_allocations)


def test_reply_revision_retry_reuses_already_sent_communication(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=[],
                summary="Caterer says chicken burritos are unavailable.",
            )
        ]
    )
    email_provider = FakeEmailProvider()
    monkeypatch.setattr(
        reply_handler,
        "send_caterer_emails",
        lambda client_arg, **kwargs: real_send_caterer_emails(
            client_arg,
            **kwargs,
            provider=email_provider,
        ),
    )
    real_update_reply = reply_handler._update_reply
    failed_once = False

    def fail_final_reply_update_once(client_arg, reply_id, payload):
        nonlocal failed_once
        if payload.get("handled_status") == "auto_adjusted" and not failed_once:
            failed_once = True
            raise RuntimeError("reply update failed after send")
        return real_update_reply(client_arg, reply_id, payload)

    monkeypatch.setattr(reply_handler, "_update_reply", fail_final_reply_update_once)
    with pytest.raises(RuntimeError, match="reply update failed after send"):
        record_and_handle_caterer_reply(
            client,
            order_run_id="run-1",
            caterer_id="caterer-1",
            communication_id="communication-original-1",
            raw_body="We are out of chicken burritos.",
            provider_message_id="<sent-revision-retry@example.com>",
            provider=provider,
        )

    monkeypatch.setattr(reply_handler, "_update_reply", real_update_reply)
    reply = client.tables["caterer_reply_intake"].rows[-1]
    result = handle_caterer_reply(client, reply["id"])

    assert result["handled_status"] == "auto_adjusted"
    assert len(email_provider.sent_messages) == 1
    assert (
        len(
            [
                row
                for row in client.tables["order_runs"].rows
                if row.get("algorithm_version") == "reply-revision-v1"
            ]
        )
        == 1
    )


def test_unknown_substitute_escalates_without_order_mutation() -> None:
    client = _revision_client()
    before_runs = [row.copy() for row in client.tables["order_runs"].rows]
    before_lines = [row.copy() for row in client.tables["order_lines"].rows]
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=["Mystery burrito"],
                summary="Caterer proposed a mystery burrito.",
            )
        ]
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="Mystery burrito instead?",
        provider=provider,
    )

    assert result["handled_status"] == "escalated"
    assert client.tables["order_runs"].rows == before_runs
    assert client.tables["order_lines"].rows == before_lines


def test_unsafe_substitute_escalates_without_order_mutation() -> None:
    client = _revision_client()
    client.tables["order_allocations"].rows[0]["dietary_tag_codes"] = ["nut_free"]
    before_runs = [row.copy() for row in client.tables["order_runs"].rows]
    provider = FakeLLMProvider(
        [
            _llm_reply(
                confidence=0.93,
                intent="unavailable_item",
                unavailable_items=["Chicken burrito"],
                proposed_replacements=["Satay bowl"],
                summary="Caterer proposed satay bowls.",
            )
        ]
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="Satay bowls instead?",
        provider=provider,
    )

    assert result["handled_status"] == "escalated"
    assert client.tables["order_runs"].rows == before_runs


def test_ingredient_safety_note_escalates_as_blocked() -> None:
    client = _reply_client()
    provider = FakeLLMProvider(
        [
            _llm_reply(
                intent="ingredient_change",
                ingredient_or_safety_note="Sauce now contains sesame.",
                summary="Caterer mentioned a sesame ingredient change.",
            )
        ]
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="FYI the sauce now contains sesame.",
        provider=provider,
    )

    assert result["parsed_intent"] == "other"
    assert result["exception"]["severity"] == "blocked"


def test_quantity_question_escalates_as_blocked() -> None:
    client = _reply_client()
    provider = FakeLLMProvider(
        [
            _llm_reply(
                intent="quantity_question",
                quantity_question="Do you need 18 or 20 meals?",
                summary="Caterer asks for quantity clarification.",
            )
        ]
    )

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="Can you confirm if this is 18 or 20 meals?",
        provider=provider,
    )

    assert result["parsed_intent"] == "quantity_question"
    assert result["exception"]["severity"] == "blocked"


def test_malformed_claude_output_escalates_through_stage_6_fallback() -> None:
    client = _reply_client()
    provider = FakeLLMProvider(["{not json"])

    result = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="Hard to parse.",
        provider=provider,
    )

    assert result["parsed_intent"] == "unknown"
    assert result["handled_status"] == "escalated"
    assert result["exception"]["severity"] == "blocked"
    assert client.tables["ai_interpretations"].rows[0]["parsed_output"]["intent"] == "ambiguous"


def test_duplicate_idempotency_key_does_not_duplicate_ai_or_exception() -> None:
    client = _reply_client()
    provider = FakeLLMProvider(
        [
            _llm_reply(
                intent="delivery_question",
                delivery_question="Should we deliver to the front office?",
                summary="Caterer asks about delivery location.",
            )
        ]
    )

    first = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="Should we deliver to the front office?",
        idempotency_key="reply-key",
        provider=provider,
    )
    second = record_and_handle_caterer_reply(
        client,
        order_run_id="run-1",
        caterer_id="caterer-1",
        raw_body="Should we deliver to the front office?",
        idempotency_key="reply-key",
        provider=provider,
    )

    assert second["reply_id"] == first["reply_id"]
    assert second["exception_id"] == first["exception_id"]
    assert len(client.tables["caterer_reply_intake"].rows) == 1
    assert len(client.tables["ai_interpretations"].rows) == 1
    assert len(client.tables["autopilot_exceptions"].rows) == 1


class FakeImapConnection:
    def __init__(self, message: EmailMessage) -> None:
        self.message = message
        self.search_criteria: list[tuple[str, ...]] = []

    def login(self, username: str, password: str):
        assert username == "orders@example.com"
        assert password == "app-password"

    def select(self, mailbox: str):
        assert mailbox == "INBOX"

    def search(self, charset, *criteria):
        assert charset is None
        self.search_criteria.append(tuple(str(item) for item in criteria))
        return "OK", [b"1"] if criteria[0] == "X-GM-RAW" else [b""]

    def fetch(self, message_set, message_parts):
        assert message_set == b"1"
        assert message_parts in {"(BODY.PEEK[])", "(BODY.PEEK[HEADER])"}
        return "OK", [(b"1 RFC822", self.message.as_bytes())]

    def logout(self):
        return "OK"


class SequencedImapConnection:
    def __init__(
        self,
        *,
        messages: dict[bytes, EmailMessage],
        search_results: list[bytes],
    ) -> None:
        self.messages = messages
        self.search_results = list(search_results)
        self.search_count = 0
        self.select_count = 0

    def login(self, username: str, password: str):
        assert username == "orders@example.com"
        assert password == "app-password"

    def select(self, mailbox: str):
        assert mailbox == "INBOX"
        self.select_count += 1

    def search(self, charset, *criteria):
        assert charset is None
        if criteria[0] != "X-GM-RAW":
            return "OK", [b""]
        index = min(self.search_count, len(self.search_results) - 1)
        self.search_count += 1
        return "OK", [self.search_results[index]]

    def fetch(self, message_set, message_parts):
        return "OK", [(b"RFC822", self.messages[message_set].as_bytes())]

    def logout(self):
        return "OK"


def test_imap_poll_retries_until_later_reply_is_visible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    message = EmailMessage()
    message["Message-ID"] = "<message-later@example.com>"
    message["From"] = "burrito@example.com"
    message["Subject"] = "Re: Padea catering order [Padea:run-1:caterer-1]"
    message.set_content("Confirmed, thanks.")
    connection = SequencedImapConnection(
        messages={b"2": message},
        search_results=[b"", b"", b"2"],
    )
    calls: list[str] = []

    def fake_record(client_arg, **kwargs):
        calls.append(kwargs["provider_message_id"])
        return {
            "reply_id": "reply-later",
            "handled_status": "auto_handled",
            "reply": {"order_run_id": "run-1"},
        }

    monkeypatch.setattr(reply_imap, "record_and_handle_caterer_reply", fake_record)
    result = reply_imap.poll_gmail_caterer_replies(
        client,
        config=reply_imap.ImapConfig(
            host="imap.example.com",
            port=993,
            mailbox="INBOX",
            username="orders@example.com",
            app_password="app-password",
        ),
        imap_factory=lambda *args, **kwargs: connection,
        retry_delays=(2, 5, 8),
        sleep=lambda delay: None,
    )

    assert result["attempt_count"] == 3
    assert result["scanned_count"] == 1
    assert result["matched_count"] == 1
    assert result["processed_count"] == 1
    assert connection.select_count == 3
    assert calls == ["<message-later@example.com>"]


def test_imap_search_returns_newest_messages_first_and_caps_results() -> None:
    connection = SequencedImapConnection(
        messages={},
        search_results=[b"1 2 3 4"],
    )

    assert reply_imap._search_message_ids(
        connection,
        max_messages=2,
        gmail_query="subject:Padea",
    ) == [b"4", b"3"]


def test_reply_links_by_in_reply_to_without_subject_token() -> None:
    client = _revision_client()

    link = reply_imap._link_reply(
        client,
        {
            "subject": "Re: Padea catering order - Burrito Co - Week of 1 May 2026",
            "in_reply_to_message_id": "<initial-burrito@padea.example>",
            "reference_message_ids": [],
            "raw_body": "Confirmed.",
        },
    )

    assert link == {
        "communication_id": "communication-original-1",
        "order_run_id": "run-1",
        "caterer_id": "caterer-1",
    }


def test_reply_references_link_to_latest_revised_communication() -> None:
    client = _revision_client()
    client.tables["order_communications"].rows.append(
        {
            "id": "communication-revised-1",
            "order_run_id": "run-revised-1",
            "caterer_id": "caterer-1",
            "status": "sent",
            "subject": "Re: Padea catering order - Burrito Co - Week of 1 May 2026",
            "outbound_message_id": "<revised-burrito@padea.example>",
        }
    )

    link = reply_imap._link_reply(
        client,
        {
            "subject": "Re: Padea catering order - Burrito Co - Week of 1 May 2026",
            "in_reply_to_message_id": None,
            "reference_message_ids": [
                "<initial-burrito@padea.example>",
                "<revised-burrito@padea.example>",
            ],
            "raw_body": "One more correction.",
        },
    )

    assert link == {
        "communication_id": "communication-revised-1",
        "order_run_id": "run-revised-1",
        "caterer_id": "caterer-1",
    }


def test_ambiguous_subject_only_reply_remains_unlinked() -> None:
    client = _revision_client()
    canonical_subject = "Padea catering order - Burrito Co - Week of 1 May 2026"
    client.tables["order_communications"].rows[0]["subject"] = canonical_subject
    client.tables["order_communications"].rows.append(
        {
            "id": "communication-duplicate",
            "order_run_id": "run-duplicate",
            "caterer_id": "caterer-1",
            "status": "sent",
            "subject": canonical_subject,
        }
    )

    link = reply_imap._link_reply(
        client,
        {
            "subject": f"Re: {canonical_subject}",
            "in_reply_to_message_id": None,
            "reference_message_ids": [],
            "raw_body": "Confirmed.",
        },
    )

    assert link is None


def test_imap_poll_deduplicates_messages_across_retry_attempts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    message = EmailMessage()
    message["Message-ID"] = "<message-seen@example.com>"
    message["From"] = "burrito@example.com"
    message["Subject"] = "Re: Padea catering order [Padea:run-1:caterer-1]"
    message.set_content("Confirmed, thanks.")
    client.tables["caterer_reply_intake"].rows.append(
        {
            "id": "reply-seen",
            "order_run_id": "run-1",
            "caterer_id": "caterer-1",
            "provider_message_id": "<message-seen@example.com>",
            "handled_status": "auto_handled",
            "metadata": {"idempotency_key": "<message-seen@example.com>"},
        }
    )
    connection = SequencedImapConnection(
        messages={b"1": message},
        search_results=[b"1", b"1", b"1", b"1"],
    )

    monkeypatch.setattr(
        reply_imap,
        "record_and_handle_caterer_reply",
        lambda *args, **kwargs: pytest.fail("Already-seen mail must not be handled."),
    )
    result = reply_imap.poll_gmail_caterer_replies(
        client,
        config=reply_imap.ImapConfig(
            host="imap.example.com",
            port=993,
            mailbox="INBOX",
            username="orders@example.com",
            app_password="app-password",
        ),
        imap_factory=lambda *args, **kwargs: connection,
        retry_delays=(2, 5, 8),
        sleep=lambda delay: None,
    )

    assert result["attempt_count"] == 4
    assert result["scanned_count"] == 1
    assert result["matched_count"] == 1
    assert result["already_seen_count"] == 1
    assert result["processed_count"] == 0


def test_imap_provider_failure_is_retryable_on_next_poll(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    message = EmailMessage()
    message["Message-ID"] = "<message-retry@example.com>"
    message["From"] = "burrito@example.com"
    message["Subject"] = "Re: Padea catering order [Padea:run-1:caterer-1]"
    message.set_content("Confirmed, thanks.")

    def failing_record(client_arg, **kwargs):
        client_arg.table("caterer_reply_intake").insert(
            {
                "order_run_id": kwargs["order_run_id"],
                "caterer_id": kwargs["caterer_id"],
                "communication_id": kwargs["communication_id"],
                "provider_message_id": kwargs["provider_message_id"],
                "subject": kwargs["subject"],
                "raw_body": kwargs["raw_body"],
                "handled_status": "received",
                "metadata": {"idempotency_key": kwargs["provider_message_id"]},
            }
        ).execute()
        raise RuntimeError("Anthropic structured generation failed")

    monkeypatch.setattr(reply_imap, "record_and_handle_caterer_reply", failing_record)
    config = reply_imap.ImapConfig(
        host="imap.example.com",
        port=993,
        mailbox="INBOX",
        username="orders@example.com",
        app_password="app-password",
    )
    first = reply_imap.poll_gmail_caterer_replies(
        client,
        config=config,
        imap_factory=lambda *args, **kwargs: FakeImapConnection(message),
        retry_delays=(),
    )

    assert first["failed_count"] == 1
    assert client.tables["caterer_reply_intake"].rows[-1]["handled_status"] == "received"
    assert client.tables["autopilot_exceptions"].rows == []

    monkeypatch.setattr(
        reply_imap,
        "handle_caterer_reply",
        lambda client_arg, reply_id, **kwargs: {
            "reply_id": reply_id,
            "handled_status": "auto_handled",
            "reply": {"order_run_id": "run-1"},
        },
    )
    second = reply_imap.poll_gmail_caterer_replies(
        client,
        config=config,
        imap_factory=lambda *args, **kwargs: FakeImapConnection(message),
        retry_delays=(),
    )

    assert second["failed_count"] == 0
    assert second["processed_count"] == 1


def test_imap_poll_links_tokened_message_and_is_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    message = EmailMessage()
    message["Message-ID"] = "<message-1@example.com>"
    message["From"] = "burrito@example.com"
    message["Subject"] = "Re: Padea catering order - Burrito Co [Padea:run-1:caterer-1]"
    message.set_content("Confirmed, thanks.")
    calls = []

    def fake_record(client_arg, **kwargs):
        calls.append(kwargs)
        row = (
            client_arg.table("caterer_reply_intake")
            .insert(
                {
                    "communication_id": kwargs["communication_id"],
                    "order_run_id": kwargs["order_run_id"],
                    "caterer_id": kwargs["caterer_id"],
                    "provider": kwargs["intake_provider"],
                    "provider_message_id": kwargs["provider_message_id"],
                    "from_email": kwargs["from_email"],
                    "subject": kwargs["subject"],
                    "raw_body": kwargs["raw_body"],
                    "received_at": kwargs["received_at"],
                    "parsed_intent": "confirmation",
                    "handled_status": "auto_handled",
                    "metadata": {"idempotency_key": kwargs["provider_message_id"]},
                }
            )
            .execute()
            .data[0]
        )
        return {
            "reply_id": row["id"],
            "ai_interpretation_id": None,
            "parsed_intent": "confirmation",
            "handled_status": "auto_handled",
            "exception_id": None,
            "summary": "Caterer confirmed the order.",
            "reply": row,
            "exception": None,
        }

    monkeypatch.setattr(reply_imap, "record_and_handle_caterer_reply", fake_record)

    config = reply_imap.ImapConfig(
        host="imap.example.com",
        port=993,
        mailbox="INBOX",
        username="orders@example.com",
        app_password="app-password",
    )
    connections: list[FakeImapConnection] = []

    def imap_factory(host: str, port: int) -> FakeImapConnection:
        assert host == "imap.example.com"
        assert port == 993
        connection = FakeImapConnection(message)
        connections.append(connection)
        return connection

    first = reply_imap.poll_gmail_caterer_replies(
        client,
        config=config,
        imap_factory=imap_factory,
        retry_delays=(),
    )
    second = reply_imap.poll_gmail_caterer_replies(
        client,
        config=config,
        imap_factory=imap_factory,
        retry_delays=(),
    )

    assert first["processed_count"] == 1
    assert first["auto_handled_count"] == 1
    assert second["processed_count"] == 0
    assert len(calls) == 1
    assert calls[0]["communication_id"] == "communication-original-1"
    assert calls[0]["intake_provider"] == "gmail_imap"
    assert connections[0].search_criteria[0] == (
        "X-GM-RAW",
        '"in:inbox newer_than:7d subject:Padea"',
    )


def test_imap_poll_skips_non_padea_messages(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _revision_client()
    message = EmailMessage()
    message["Message-ID"] = "<message-2@example.com>"
    message["From"] = "someone@example.com"
    message["Subject"] = "Ordinary unread email"
    message.set_content("This is not a Padea order reply.")

    def fake_record(*args, **kwargs):
        raise AssertionError("Non-Padea messages must not be handled.")

    monkeypatch.setattr(reply_imap, "record_and_handle_caterer_reply", fake_record)

    config = reply_imap.ImapConfig(
        host="imap.example.com",
        port=993,
        mailbox="INBOX",
        username="orders@example.com",
        app_password="app-password",
    )

    def imap_factory(host: str, port: int) -> FakeImapConnection:
        return FakeImapConnection(message)

    result = reply_imap.poll_gmail_caterer_replies(
        client,
        config=config,
        imap_factory=imap_factory,
        retry_delays=(),
    )

    assert result["processed_count"] == 0
    assert client.tables["caterer_reply_intake"].rows == []


def test_imap_poll_resumes_existing_received_reply(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _revision_client()
    message = EmailMessage()
    message["Message-ID"] = "<message-received@example.com>"
    message["From"] = "burrito@example.com"
    message["Subject"] = "Re: Padea catering order - Burrito Co [Padea:run-1:caterer-1]"
    message.set_content("Confirmed, thanks.")
    client.tables["caterer_reply_intake"].rows.append(
        {
            "id": "reply-existing",
            "communication_id": "communication-original-1",
            "order_run_id": "run-1",
            "caterer_id": "caterer-1",
            "provider": "gmail_imap",
            "provider_message_id": "<message-received@example.com>",
            "from_email": "burrito@example.com",
            "subject": message["Subject"],
            "raw_body": "Confirmed, thanks.",
            "received_at": "2026-06-06T00:00:00+00:00",
            "handled_status": "received",
            "metadata": {"idempotency_key": "<message-received@example.com>"},
        }
    )
    handled_ids: list[str] = []

    def fake_handle(client_arg, reply_id, *, actor_name=None, provider=None):
        handled_ids.append(reply_id)
        row = client_arg.tables["caterer_reply_intake"].rows[0]
        row.update(
            {
                "handled_status": "auto_handled",
                "parsed_intent": "confirmation",
                "handling_summary": "Caterer confirmed the order.",
            }
        )
        return {
            "reply_id": reply_id,
            "ai_interpretation_id": None,
            "parsed_intent": "confirmation",
            "handled_status": "auto_handled",
            "exception_id": None,
            "summary": "Caterer confirmed the order.",
            "reply": row,
            "exception": None,
        }

    monkeypatch.setattr(reply_imap, "handle_caterer_reply", fake_handle)
    config = reply_imap.ImapConfig(
        host="imap.example.com",
        port=993,
        mailbox="INBOX",
        username="orders@example.com",
        app_password="app-password",
    )

    def imap_factory(host: str, port: int) -> FakeImapConnection:
        return FakeImapConnection(message)

    result = reply_imap.poll_gmail_caterer_replies(
        client,
        config=config,
        imap_factory=imap_factory,
        retry_delays=(),
    )

    assert result["processed_count"] == 1
    assert result["auto_handled_count"] == 1
    assert handled_ids == ["reply-existing"]


def _add_newer_sent_run_for_same_caterer(client: FakeClient) -> None:
    client.tables["order_runs"].rows[0]["generated_at"] = "2026-05-01T00:00:00+00:00"
    client.tables["order_runs"].rows.append(
        {
            "id": "run-new",
            "status": "approved",
            "service_week_start": "2026-05-01",
            "generated_at": "2026-05-02T00:00:00+00:00",
        }
    )
    client.tables["order_communications"].rows.append(
        {
            "id": "communication-new-1",
            "order_run_id": "run-new",
            "caterer_id": "caterer-1",
            "status": "sent",
            "subject": "Padea catering order - Burrito Co [Padea:run-new:caterer-1]",
        }
    )


def test_imap_poll_ignores_new_reply_to_stale_run(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _revision_client()
    _add_newer_sent_run_for_same_caterer(client)
    message = EmailMessage()
    message["Message-ID"] = "<message-stale-new@example.com>"
    message["From"] = "burrito@example.com"
    message["Subject"] = "Re: Padea catering order - Burrito Co [Padea:run-1:caterer-1]"
    message.set_content("Confirmed for the old order.")

    def fake_record(*args, **kwargs):
        raise AssertionError("Stale replies must not be handled by Claude.")

    monkeypatch.setattr(reply_imap, "record_and_handle_caterer_reply", fake_record)
    config = reply_imap.ImapConfig(
        host="imap.example.com",
        port=993,
        mailbox="INBOX",
        username="orders@example.com",
        app_password="app-password",
    )

    def imap_factory(host: str, port: int) -> FakeImapConnection:
        return FakeImapConnection(message)

    result = reply_imap.poll_gmail_caterer_replies(
        client,
        config=config,
        imap_factory=imap_factory,
        retry_delays=(),
    )

    ignored = client.tables["caterer_reply_intake"].rows[0]
    assert result["processed_count"] == 0
    assert ignored["order_run_id"] == "run-1"
    assert ignored["handled_status"] == "ignored"
    assert ignored["metadata"]["ignore_reason"] == "stale_order_run_reply"
    assert client.tables["ai_interpretations"].rows == []
    assert (
        client.tables["audit_log"].rows[-1]["reason"] == "Stale caterer reply received and ignored."
    )


def test_imap_poll_ignores_existing_received_reply_to_stale_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _revision_client()
    _add_newer_sent_run_for_same_caterer(client)
    message = EmailMessage()
    message["Message-ID"] = "<message-stale-existing@example.com>"
    message["From"] = "burrito@example.com"
    message["Subject"] = "Re: Padea catering order - Burrito Co [Padea:run-1:caterer-1]"
    message.set_content("Confirmed for the old order.")
    client.tables["caterer_reply_intake"].rows.append(
        {
            "id": "reply-existing-stale",
            "communication_id": "communication-original-1",
            "order_run_id": "run-1",
            "caterer_id": "caterer-1",
            "provider": "gmail_imap",
            "provider_message_id": "<message-stale-existing@example.com>",
            "from_email": "burrito@example.com",
            "subject": message["Subject"],
            "raw_body": "Confirmed for the old order.",
            "received_at": "2026-06-06T00:00:00+00:00",
            "handled_status": "received",
            "metadata": {"idempotency_key": "<message-stale-existing@example.com>"},
        }
    )

    def fake_handle(*args, **kwargs):
        raise AssertionError("Stale received replies must not be handled by Claude.")

    monkeypatch.setattr(reply_imap, "handle_caterer_reply", fake_handle)
    config = reply_imap.ImapConfig(
        host="imap.example.com",
        port=993,
        mailbox="INBOX",
        username="orders@example.com",
        app_password="app-password",
    )

    def imap_factory(host: str, port: int) -> FakeImapConnection:
        return FakeImapConnection(message)

    result = reply_imap.poll_gmail_caterer_replies(
        client,
        config=config,
        imap_factory=imap_factory,
        retry_delays=(),
    )

    ignored = client.tables["caterer_reply_intake"].rows[0]
    assert result["processed_count"] == 0
    assert ignored["handled_status"] == "ignored"
    assert ignored["metadata"]["ignore_reason"] == "stale_order_run_reply"
    assert client.tables["ai_interpretations"].rows == []


def test_imap_debug_lists_candidate_without_handling(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _revision_client()
    message = EmailMessage()
    message["Message-ID"] = "<message-debug@example.com>"
    message["From"] = "burrito@example.com"
    message["Subject"] = "Re: Padea catering order - Burrito Co [Padea:run-1:caterer-1]"
    message.set_content("Confirmed, thanks.")

    def fake_record(*args, **kwargs):
        raise AssertionError("Debug search must not handle replies.")

    monkeypatch.setattr(reply_imap, "record_and_handle_caterer_reply", fake_record)
    config = reply_imap.ImapConfig(
        host="imap.example.com",
        port=993,
        mailbox="INBOX",
        username="orders@example.com",
        app_password="app-password",
    )

    def imap_factory(host: str, port: int) -> FakeImapConnection:
        return FakeImapConnection(message)

    result = reply_imap.debug_gmail_reply_search(
        client,
        config=config,
        imap_factory=imap_factory,
    )

    assert result["matched_message_count"] == 1
    assert result["candidates"][0]["probable_padea_reply"] is True
    assert result["candidates"][0]["link_status"] == "linked"
    assert result["candidates"][0]["communication_id"] == "communication-original-1"
    assert client.tables["caterer_reply_intake"].rows == []


def test_handle_reuses_existing_ai_interpretation() -> None:
    client = _reply_client()
    client.tables["caterer_reply_intake"].rows.append(
        {
            "id": "reply-1",
            "order_run_id": "run-1",
            "caterer_id": "caterer-1",
            "raw_body": "Confirmed",
            "received_at": "2026-06-05T00:00:00+00:00",
            "handled_status": "received",
            "ai_interpretation_id": "ai-1",
            "metadata": {},
        }
    )
    client.tables["ai_interpretations"].rows.append(
        {
            "id": "ai-1",
            "confidence": 0.95,
            "needs_human_review": False,
            "parsed_output": json.loads(_llm_reply(confidence=0.95)),
        }
    )
    provider = FakeLLMProvider([])

    result = handle_caterer_reply(client, "reply-1", provider=provider)

    assert result["handled_status"] == "auto_handled"
    assert len(client.tables["ai_interpretations"].rows) == 1


def test_intent_mapping_matches_reply_intake_enum_values() -> None:
    assert INTENT_TO_DB == {
        "confirmed": "confirmation",
        "unavailable_item": "item_unavailable",
        "quantity_question": "quantity_question",
        "delivery_question": "delivery_question",
        "ingredient_change": "other",
        "other": "other",
        "ambiguous": "unknown",
    }


def test_cli_parser_validates_required_args() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args([])


def test_cli_file_based_raw_body_is_accepted(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    reply_file = tmp_path / "reply.txt"
    reply_file.write_text("Confirmed", encoding="utf-8")

    def fake_get_client():
        return object()

    def fake_record(client, **kwargs):
        assert kwargs["raw_body"] == "Confirmed"
        assert kwargs["order_run_id"] == "run-1"
        assert kwargs["caterer_id"] == "caterer-1"
        return {
            "reply_id": "reply-1",
            "ai_interpretation_id": "ai-1",
            "parsed_intent": "confirmation",
            "handled_status": "auto_handled",
            "exception_id": None,
            "summary": "Caterer confirmed the order.",
        }

    monkeypatch.setattr("padea_catering.replies.__main__.get_client", fake_get_client)
    monkeypatch.setattr(
        "padea_catering.replies.__main__.record_and_handle_caterer_reply",
        fake_record,
    )

    assert (
        main(
            [
                "--order-run-id",
                "run-1",
                "--caterer-id",
                "caterer-1",
                "--raw-body-file",
                str(reply_file),
            ]
        )
        == 0
    )
    output = json.loads(capsys.readouterr().out)
    assert output == {
        "reply_id": "reply-1",
        "ai_interpretation_id": "ai-1",
        "parsed_intent": "confirmation",
        "handled_status": "auto_handled",
        "exception_id": None,
        "summary": "Caterer confirmed the order.",
    }
