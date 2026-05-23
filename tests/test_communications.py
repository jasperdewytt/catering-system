"""Unit tests for communication export persistence."""

from __future__ import annotations

import pytest

from padea_catering.communications import record_communication_export
from tests.test_operations import FakeClient, FakeTable


def _client_with_export_data() -> FakeClient:
    client = FakeClient()
    client.tables["order_runs"].rows[0].update(
        {
            "status": "approved",
            "issue_count": 0,
        }
    )
    client.tables.update(
        {
            "caterers": FakeTable(
                "caterers",
                [
                    {
                        "id": "cat-1",
                        "name": "Example Caterer",
                        "delivery_fee_cents": 1000,
                        "delivery_scope": "per_school_per_trip",
                    }
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
                        "caterer_id": "cat-1",
                        "school_id": "school-1",
                        "session_date": "2026-05-01",
                        "dinner_time": "18:00:00",
                        "building": "Library",
                        "room": None,
                        "manager_name": "Jessie",
                        "manager_mobile": "0412 345 678",
                    }
                ],
            ),
            "dishes": FakeTable("dishes", [{"id": "dish-1", "name": "Cali Burrito"}]),
            "dish_variants": FakeTable(
                "dish_variants",
                [{"id": "variant-1", "dish_id": "dish-1", "name": "Vegetarian"}],
            ),
            "order_lines": FakeTable(
                "order_lines",
                [
                    {
                        "id": "line-1",
                        "order_run_id": "run-1",
                        "session_id": "session-1",
                        "dish_id": "dish-1",
                        "dish_variant_id": "variant-1",
                        "quantity": 3,
                        "unit_price_cents": 1200,
                        "line_total_cents": 3600,
                    }
                ],
            ),
            "caterer_contacts": FakeTable(
                "caterer_contacts",
                [
                    {
                        "id": "contact-1",
                        "caterer_id": "cat-1",
                        "role": "primary",
                        "display_name": "Primary",
                        "email": "primary@example.com",
                        "cc_preference": "to",
                    }
                ],
            ),
            "order_communications": FakeTable("order_communications", []),
            "order_communication_recipients": FakeTable("order_communication_recipients", []),
            "order_communication_events": FakeTable("order_communication_events", []),
        }
    )
    return client


@pytest.mark.parametrize("status", ["generated", "blocked", "superseded"])
def test_record_communication_export_rejects_unapproved_runs(status: str) -> None:
    client = _client_with_export_data()
    client.tables["order_runs"].rows[0]["status"] = status

    with pytest.raises(ValueError, match="Only approved"):
        record_communication_export(
            client,
            order_run_id="run-1",
            caterer_id="cat-1",
            actor_name="Operator",
            reason="Reviewed",
        )


def test_record_communication_export_rejects_approved_run_with_issues() -> None:
    client = _client_with_export_data()
    client.tables["order_runs"].rows[0]["issue_count"] = 1

    with pytest.raises(ValueError, match="allocation issues"):
        record_communication_export(
            client,
            order_run_id="run-1",
            caterer_id="cat-1",
            actor_name="Operator",
            reason="Reviewed",
        )


def test_record_communication_export_requires_actor_and_reason() -> None:
    client = _client_with_export_data()

    with pytest.raises(ValueError, match="actor_name is required"):
        record_communication_export(
            client,
            order_run_id="run-1",
            caterer_id="cat-1",
            actor_name="",
            reason="Reviewed",
        )
    with pytest.raises(ValueError, match="reason is required"):
        record_communication_export(
            client,
            order_run_id="run-1",
            caterer_id="cat-1",
            actor_name="Operator",
            reason="",
        )


def test_record_communication_export_creates_snapshot_event_and_audit() -> None:
    client = _client_with_export_data()

    result = record_communication_export(
        client,
        order_run_id="run-1",
        caterer_id="cat-1",
        actor_name="Operator",
        reason="Reviewed and exported",
    )

    communication = client.tables["order_communications"].rows[0]
    recipient = client.tables["order_communication_recipients"].rows[0]
    event = client.tables["order_communication_events"].rows[0]
    audit = client.tables["audit_log"].rows[0]

    assert result["snapshot_created"] is True
    assert communication["subject"] == "Padea catering order - Example Caterer"
    assert "3 x Cali Burrito - Vegetarian" in communication["rendered_text"]
    assert "Jessie 0412 345 678" in communication["delivery_note_text"]
    assert recipient["email"] == "primary@example.com"
    assert recipient["recipient_type"] == "to"
    assert event["event_type"] == "exported"
    assert audit["action"] == "communication_exported"
    assert audit["entity_id"] == communication["id"]


def test_record_communication_export_reuses_snapshot_on_repeated_export() -> None:
    client = _client_with_export_data()
    first = record_communication_export(
        client,
        order_run_id="run-1",
        caterer_id="cat-1",
        actor_name="Operator",
        reason="First export",
    )
    client.tables["caterer_contacts"].rows[0]["email"] = "changed@example.com"

    second = record_communication_export(
        client,
        order_run_id="run-1",
        caterer_id="cat-1",
        actor_name="Operator",
        reason="Second export",
    )

    assert first["communication"]["id"] == second["communication"]["id"]
    assert second["snapshot_created"] is False
    assert len(client.tables["order_communications"].rows) == 1
    assert len(client.tables["order_communication_recipients"].rows) == 1
    assert len(client.tables["order_communication_events"].rows) == 2
    assert client.tables["order_communication_recipients"].rows[0]["email"] == "primary@example.com"
