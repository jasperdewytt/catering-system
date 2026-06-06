"""Unit tests for communication export persistence."""

from __future__ import annotations

import pytest

from padea_catering.communications import record_communication_export, send_caterer_emails
from padea_catering.communications.actions import (
    EmailDeliveryError,
    EmailProvider,
    email_provider_from_env,
)
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


class FakeEmailProvider(EmailProvider):
    provider_name = "fake"

    def __init__(self, fail_ids: set[str] | None = None) -> None:
        self.fail_ids = fail_ids or set()
        self.sent_subjects: list[str] = []
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
        self.sent_subjects.append(subject)
        self.sent_messages.append(
            {
                "subject": subject,
                "body": body,
                "to_emails": to_emails,
                "message_id": message_id,
                "in_reply_to": in_reply_to,
                "references": references or [],
            }
        )
        if subject in self.fail_ids:
            raise EmailDeliveryError("SMTP rejected message")
        return {
            "provider": self.provider_name,
            "requested_recipients": to_emails,
            "actual_recipients": ["test@example.com"],
            "message_id": f"message-{len(self.sent_subjects)}",
        }


def _client_with_send_data() -> FakeClient:
    client = _client_with_export_data()
    first = record_communication_export(
        client,
        order_run_id="run-1",
        caterer_id="cat-1",
        actor_name="Operator",
        reason="Initial snapshot",
    )
    communication = client.tables["order_communications"].rows[0]
    communication["id"] = first["communication"]["id"]
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
    assert communication["subject"] == (
        "Padea catering order - Example Caterer - Week of 1 May 2026"
    )
    assert "[Padea:" not in communication["subject"]
    assert communication["template_version"] == "caterer-order-v3"
    assert "Example School - Fri 1 May - dinner 6pm" in communication["rendered_text"]
    assert "3 x Cali Burrito - Vegetarian" in communication["rendered_text"]
    assert "Total meals: 3" in communication["rendered_text"]
    assert "Please confirm receipt" in communication["rendered_text"]
    assert "Item subtotal" not in communication["rendered_text"]
    assert "Delivery fee noted" not in communication["rendered_text"]
    assert "Jessie 0412 345 678" in communication["delivery_note_text"]
    assert "18:00:00" not in communication["delivery_note_text"]
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


def test_send_caterer_emails_records_sent_event_metadata_and_audit() -> None:
    client = _client_with_send_data()
    communication_id = client.tables["order_communications"].rows[0]["id"]
    provider = FakeEmailProvider()

    result = send_caterer_emails(
        client,
        order_run_id="run-1",
        communication_ids=[communication_id],
        actor_name="Operator",
        reason="Send reviewed snapshot",
        provider=provider,
    )

    communication = client.tables["order_communications"].rows[0]
    event = client.tables["order_communication_events"].rows[-1]
    audit = client.tables["audit_log"].rows[-1]

    assert len(result["sent"]) == 1
    assert result["failed"] == []
    assert communication["status"] == "sent"
    assert communication["outbound_message_id"].startswith("<")
    assert provider.sent_messages[0]["message_id"] == communication["outbound_message_id"]
    assert provider.sent_messages[0]["in_reply_to"] is None
    assert provider.sent_messages[0]["references"] == []
    assert event["event_type"] == "sent"
    assert event["metadata"]["provider"] == "fake"
    assert event["metadata"]["requested_recipients"] == ["primary@example.com"]
    assert audit["action"] == "communication_sent"
    assert audit["after_state"]["status"] == "sent"


def test_send_retry_reuses_persisted_outbound_message_id() -> None:
    client = _client_with_send_data()
    communication = client.tables["order_communications"].rows[0]
    provider = FakeEmailProvider(fail_ids={communication["subject"]})

    first = send_caterer_emails(
        client,
        order_run_id="run-1",
        communication_ids=[communication["id"]],
        actor_name="Operator",
        reason="First attempt",
        provider=provider,
    )
    persisted_message_id = communication["outbound_message_id"]
    provider.fail_ids.clear()
    second = send_caterer_emails(
        client,
        order_run_id="run-1",
        communication_ids=[communication["id"]],
        actor_name="Operator",
        reason="Retry",
        provider=provider,
    )

    assert len(first["failed"]) == 1
    assert len(second["sent"]) == 1
    assert provider.sent_messages[0]["message_id"] == persisted_message_id
    assert provider.sent_messages[1]["message_id"] == persisted_message_id


def test_send_caterer_emails_records_failed_event_error_and_audit() -> None:
    client = _client_with_send_data()
    communication = client.tables["order_communications"].rows[0]

    result = send_caterer_emails(
        client,
        order_run_id="run-1",
        communication_ids=[communication["id"]],
        actor_name="Operator",
        reason="Send reviewed snapshot",
        provider=FakeEmailProvider(fail_ids={communication["subject"]}),
    )

    event = client.tables["order_communication_events"].rows[-1]
    audit = client.tables["audit_log"].rows[-1]

    assert result["sent"] == []
    assert len(result["failed"]) == 1
    assert client.tables["order_communications"].rows[0]["status"] == "failed"
    assert event["event_type"] == "send_failed"
    assert event["metadata"]["error"] == "SMTP rejected message"
    assert audit["action"] == "communication_send_failed"


def test_send_caterer_emails_returns_mixed_batch_results() -> None:
    client = _client_with_send_data()
    first = client.tables["order_communications"].rows[0]
    second = {
        **first,
        "id": "communication-2",
        "caterer_id": "cat-1",
        "subject": "Fail me",
        "status": "exported",
    }
    client.tables["order_communications"].rows.append(second)
    client.tables["order_communication_recipients"].rows.append(
        {
            "id": "recipient-2",
            "communication_id": "communication-2",
            "email": "second@example.com",
            "recipient_type": "to",
        }
    )

    result = send_caterer_emails(
        client,
        order_run_id="run-1",
        communication_ids=[first["id"], "communication-2"],
        actor_name="Operator",
        reason="Send reviewed snapshot",
        provider=FakeEmailProvider(fail_ids={"Fail me"}),
    )

    assert [row["communication_id"] for row in result["sent"]] == [first["id"]]
    assert [row["communication_id"] for row in result["failed"]] == ["communication-2"]
    assert client.tables["order_communications"].rows[0]["status"] == "sent"
    assert client.tables["order_communications"].rows[1]["status"] == "failed"


@pytest.mark.parametrize("status", ["generated", "blocked", "superseded"])
def test_send_caterer_emails_rejects_unapproved_runs(status: str) -> None:
    client = _client_with_send_data()
    client.tables["order_runs"].rows[0]["status"] = status
    communication_id = client.tables["order_communications"].rows[0]["id"]

    with pytest.raises(ValueError, match="Only approved"):
        send_caterer_emails(
            client,
            order_run_id="run-1",
            communication_ids=[communication_id],
            actor_name="Operator",
            reason="Send reviewed snapshot",
            provider=FakeEmailProvider(),
        )


def test_send_caterer_emails_rejects_approved_run_with_issues() -> None:
    client = _client_with_send_data()
    client.tables["order_runs"].rows[0]["issue_count"] = 1
    communication_id = client.tables["order_communications"].rows[0]["id"]

    with pytest.raises(ValueError, match="allocation issues"):
        send_caterer_emails(
            client,
            order_run_id="run-1",
            communication_ids=[communication_id],
            actor_name="Operator",
            reason="Send reviewed snapshot",
            provider=FakeEmailProvider(),
        )


def test_send_caterer_emails_rejects_missing_snapshot_missing_recipient_and_sent() -> None:
    client = _client_with_send_data()
    communication = client.tables["order_communications"].rows[0]

    with pytest.raises(ValueError, match="persisted snapshots"):
        send_caterer_emails(
            client,
            order_run_id="run-1",
            communication_ids=["missing"],
            actor_name="Operator",
            reason="Send reviewed snapshot",
            provider=FakeEmailProvider(),
        )

    client.tables["order_communication_recipients"].rows = []
    with pytest.raises(ValueError, match="at least one to recipient"):
        send_caterer_emails(
            client,
            order_run_id="run-1",
            communication_ids=[communication["id"]],
            actor_name="Operator",
            reason="Send reviewed snapshot",
            provider=FakeEmailProvider(),
        )

    client = _client_with_send_data()
    communication = client.tables["order_communications"].rows[0]
    communication["status"] = "sent"
    with pytest.raises(ValueError, match="cannot be resent"):
        send_caterer_emails(
            client,
            order_run_id="run-1",
            communication_ids=[communication["id"]],
            actor_name="Operator",
            reason="Send reviewed snapshot",
            provider=FakeEmailProvider(),
        )


def test_send_caterer_emails_requires_reason() -> None:
    client = _client_with_send_data()
    communication_id = client.tables["order_communications"].rows[0]["id"]

    with pytest.raises(ValueError, match="reason is required"):
        send_caterer_emails(
            client,
            order_run_id="run-1",
            communication_ids=[communication_id],
            actor_name="Operator",
            reason="",
            provider=FakeEmailProvider(),
        )


def test_email_provider_from_env_requires_test_recipient_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PADEA_EMAIL_PROVIDER", "gmail_smtp")
    monkeypatch.setenv("PADEA_EMAIL_FROM", "orders@example.com")
    monkeypatch.setenv("PADEA_GMAIL_SMTP_USERNAME", "orders@example.com")
    monkeypatch.setenv("PADEA_GMAIL_SMTP_APP_PASSWORD", "app-password")
    monkeypatch.delenv("PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE", raising=False)

    with pytest.raises(ValueError, match="PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE"):
        email_provider_from_env()
