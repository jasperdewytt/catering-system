from __future__ import annotations

import pytest

from padea_catering.feedback.service import (
    feedback_link_for_request,
    recompute_student_preference_signals,
    submit_student_feedback,
)
from padea_catering.feedback.tokens import sign_feedback_request, verify_feedback_token
from tests.test_operations import FakeClient, FakeQuery, FakeTable

REQUEST_ID = "11111111-1111-1111-1111-111111111111"


class UpsertTable(FakeTable):
    def upsert(self, payload: dict, on_conflict: str):
        return UpsertQuery(self, payload, on_conflict)


class UpsertQuery:
    def __init__(self, table: UpsertTable, payload: dict, on_conflict: str):
        self.table = table
        self.payload = payload
        self.on_conflict = [column.strip() for column in on_conflict.split(",")]

    def execute(self):
        for row in self.table.rows:
            if all(row.get(column) == self.payload.get(column) for column in self.on_conflict):
                row.update(self.payload)
                return type("Result", (), {"data": [row.copy()]})()
        payload = self.payload.copy()
        payload.setdefault("id", f"{self.table.name}-{len(self.table.rows) + 1}")
        self.table.rows.append(payload)
        return type("Result", (), {"data": [payload.copy()]})()


def test_feedback_token_round_trips_and_detects_tampering(monkeypatch) -> None:
    monkeypatch.setenv("PADEA_FEEDBACK_LINK_SECRET", "test-secret")

    token = sign_feedback_request(REQUEST_ID)

    assert verify_feedback_token(token) == REQUEST_ID
    with pytest.raises(ValueError, match="invalid"):
        verify_feedback_token(f"{REQUEST_ID}.tampered")


def test_feedback_link_uses_audience_route(monkeypatch) -> None:
    monkeypatch.setenv("PADEA_FEEDBACK_LINK_SECRET", "test-secret")
    monkeypatch.setenv("PADEA_WEB_PUBLIC_URL", "https://ops.example.test")

    link = feedback_link_for_request(REQUEST_ID, "session_manager")

    assert link.startswith("https://ops.example.test/feedback/session/")


def test_student_feedback_submission_marks_request_and_queues_processing(monkeypatch) -> None:
    monkeypatch.setenv("PADEA_FEEDBACK_LINK_SECRET", "test-secret")
    queued: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "padea_catering.feedback.service._queue_processing",
        lambda _client, *, feedback_type, feedback_id: queued.append((feedback_type, feedback_id)),
    )
    client = FakeClient()
    client.tables.update(
        {
            "feedback_requests": FakeTable(
                "feedback_requests",
                [
                    {
                        "id": REQUEST_ID,
                        "audience": "student",
                        "status": "sent",
                        "order_run_id": "run-1",
                        "session_id": "session-1",
                        "order_allocation_id": "allocation-1",
                        "student_id": "student-1",
                        "expires_at": "2026-06-10T00:00:00+00:00",
                    }
                ],
            ),
            "order_allocations": FakeTable(
                "order_allocations",
                [{"id": "allocation-1", "dish_variant_id": "variant-1"}],
            ),
            "student_meal_feedback": FakeTable("student_meal_feedback", []),
        }
    )

    result = submit_student_feedback(
        client,
        token=sign_feedback_request(REQUEST_ID),
        rating=4,
        free_text="Good",
        requested_food="Nachos",
    )

    assert result["request"]["status"] == "submitted"
    assert result["feedback"]["liked"] is True
    assert queued == [("student", result["feedback"]["id"])]
    assert client.tables["audit_log"].rows[-1]["action"] == "feedback_recorded"


def test_recompute_preference_signals_uses_exact_requested_dish_tags(monkeypatch) -> None:
    client = FakeClient()
    client.tables.update(
        {
            "student_meal_feedback": FakeTable(
                "student_meal_feedback",
                [
                    {
                        "id": "feedback-1",
                        "student_id": "student-1",
                        "dish_variant_id": None,
                        "rating": 5,
                        "liked": None,
                        "requested_food": "Vegetarian nachos",
                        "created_at": "2026-06-06T00:00:00+00:00",
                    }
                ],
            ),
            "ai_interpretations": FakeTable("ai_interpretations", []),
            "student_preference_signals": UpsertTable("student_preference_signals", []),
        }
    )
    monkeypatch.setattr(
        "padea_catering.feedback.service._exact_requested_variant_id",
        lambda _client, requested_food: "variant-nachos" if requested_food else None,
    )
    monkeypatch.setattr(
        "padea_catering.feedback.service._variant_tags",
        lambda _client, variant_id: {"mexican", "crispy"} if variant_id else set(),
    )

    count = recompute_student_preference_signals(client, "student-1")

    assert count == 2
    rows = client.tables["student_preference_signals"].rows
    assert {row["tag_code"] for row in rows} == {"mexican", "crispy"}
    assert all(row["affinity_score"] > 0 for row in rows)


def test_fake_query_still_behaves_like_existing_tests() -> None:
    table = FakeTable("example", [{"id": "1", "status": "open"}])
    assert isinstance(table.select("*").eq("id", "1"), FakeQuery)
