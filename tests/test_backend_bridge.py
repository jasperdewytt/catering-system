from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from padea_catering import backend
from tests.test_operations import FakeClient, FakeTable


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: object())
    return TestClient(backend.app)


def test_create_caterer_email_snapshot_success(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_record_communication_export(*args, **kwargs):
        assert kwargs == {
            "order_run_id": "run-1",
            "caterer_id": "caterer-1",
            "actor_name": "Padea Operator",
            "reason": "Prepared from web",
        }
        return {
            "communication": {"id": "communication-1"},
            "event": {"id": "event-1"},
            "snapshot_created": True,
        }

    monkeypatch.setattr(
        backend,
        "record_communication_export",
        fake_record_communication_export,
    )

    response = client.post(
        "/internal/caterer-email-snapshots",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "run-1",
            "catererId": "caterer-1",
            "actorName": "Padea Operator",
            "reason": "Prepared from web",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "communicationId": "communication-1",
        "eventId": "event-1",
        "snapshotCreated": True,
    }


@pytest.mark.parametrize("payload_reason", [None, "   "])
def test_create_caterer_email_snapshot_uses_default_reason(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    payload_reason: str | None,
) -> None:
    def fake_record_communication_export(*args, **kwargs):
        assert kwargs["reason"] == "Created caterer email snapshot from website."
        return {
            "communication": {"id": "communication-1"},
            "event": {"id": "event-1"},
            "snapshot_created": True,
        }

    monkeypatch.setattr(
        backend,
        "record_communication_export",
        fake_record_communication_export,
    )
    payload = {
        "orderRunId": "run-1",
        "catererId": "caterer-1",
        "actorName": "Padea Operator",
    }
    if payload_reason is not None:
        payload["reason"] = payload_reason

    response = client.post(
        "/internal/caterer-email-snapshots",
        headers={"Authorization": "Bearer test-secret"},
        json=payload,
    )

    assert response.status_code == 200


@pytest.mark.parametrize(
    ("headers", "status_code"),
    [
        ({}, 401),
        ({"Authorization": "Basic test-secret"}, 401),
        ({"Authorization": "Bearer wrong-secret"}, 403),
    ],
)
def test_create_caterer_email_snapshot_rejects_invalid_bearer_token(
    client: TestClient,
    headers: dict[str, str],
    status_code: int,
) -> None:
    response = client.post(
        "/internal/caterer-email-snapshots",
        headers=headers,
        json={
            "orderRunId": "run-1",
            "catererId": "caterer-1",
            "actorName": "Padea Operator",
            "reason": "Prepared from web",
        },
    )

    assert response.status_code == status_code


def test_create_caterer_email_snapshot_rejects_invalid_payload(client: TestClient) -> None:
    response = client.post(
        "/internal/caterer-email-snapshots",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "",
            "catererId": "caterer-1",
            "actorName": "Padea Operator",
            "reason": "Prepared from web",
        },
    )

    assert response.status_code == 422


def test_create_caterer_email_snapshot_returns_operation_failure(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_record_communication_export(*args, **kwargs):
        raise ValueError("Only approved order runs can be exported.")

    monkeypatch.setattr(
        backend,
        "record_communication_export",
        fake_record_communication_export,
    )

    response = client.post(
        "/internal/caterer-email-snapshots",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "run-1",
            "catererId": "caterer-1",
            "actorName": "Padea Operator",
            "reason": "Prepared from web",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only approved order runs can be exported."


def test_send_caterer_emails_success(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_send_caterer_emails(*args, **kwargs):
        assert kwargs == {
            "order_run_id": "run-1",
            "communication_ids": ["communication-1"],
            "actor_name": "Padea Operator",
            "reason": "Reviewed and ready to send",
        }
        return {
            "sent": [
                {
                    "communication_id": "communication-1",
                    "event_id": "event-1",
                    "status": "sent",
                    "caterer_id": "caterer-1",
                    "metadata": {"provider": "fake"},
                }
            ],
            "failed": [],
        }

    monkeypatch.setattr(backend, "send_caterer_emails", fake_send_caterer_emails)

    response = client.post(
        "/internal/caterer-email-sends",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "run-1",
            "communicationIds": ["communication-1"],
            "actorName": "Padea Operator",
            "reason": "Reviewed and ready to send",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "sent": [
            {
                "communicationId": "communication-1",
                "eventId": "event-1",
                "status": "sent",
                "catererId": "caterer-1",
                "metadata": {"provider": "fake"},
            }
        ],
        "failed": [],
    }


def test_send_caterer_emails_returns_mixed_results(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_send_caterer_emails(*args, **kwargs):
        return {
            "sent": [
                {
                    "communication_id": "communication-1",
                    "event_id": "event-1",
                    "status": "sent",
                    "caterer_id": "caterer-1",
                    "metadata": {"provider": "fake"},
                }
            ],
            "failed": [
                {
                    "communication_id": "communication-2",
                    "event_id": "event-2",
                    "status": "failed",
                    "caterer_id": "caterer-2",
                    "metadata": {"provider": "fake", "error": "SMTP rejected message"},
                }
            ],
        }

    monkeypatch.setattr(backend, "send_caterer_emails", fake_send_caterer_emails)

    response = client.post(
        "/internal/caterer-email-sends",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "run-1",
            "communicationIds": ["communication-1", "communication-2"],
            "actorName": "Padea Operator",
            "reason": "Reviewed and ready to send",
        },
    )

    assert response.status_code == 200
    assert response.json()["sent"][0]["status"] == "sent"
    assert response.json()["failed"][0]["status"] == "failed"


@pytest.mark.parametrize(
    ("headers", "status_code"),
    [
        ({}, 401),
        ({"Authorization": "Basic test-secret"}, 401),
        ({"Authorization": "Bearer wrong-secret"}, 403),
    ],
)
def test_send_caterer_emails_rejects_invalid_bearer_token(
    client: TestClient,
    headers: dict[str, str],
    status_code: int,
) -> None:
    response = client.post(
        "/internal/caterer-email-sends",
        headers=headers,
        json={
            "orderRunId": "run-1",
            "communicationIds": ["communication-1"],
            "actorName": "Padea Operator",
            "reason": "Reviewed and ready to send",
        },
    )

    assert response.status_code == status_code


def test_send_caterer_emails_rejects_invalid_payload(client: TestClient) -> None:
    response = client.post(
        "/internal/caterer-email-sends",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "run-1",
            "communicationIds": [],
            "actorName": "Padea Operator",
            "reason": "Reviewed and ready to send",
        },
    )

    assert response.status_code == 422


def test_send_caterer_emails_returns_operation_failure(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_send_caterer_emails(*args, **kwargs):
        raise ValueError("Already-sent caterer emails cannot be resent in v1.")

    monkeypatch.setattr(backend, "send_caterer_emails", fake_send_caterer_emails)

    response = client.post(
        "/internal/caterer-email-sends",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "run-1",
            "communicationIds": ["communication-1"],
            "actorName": "Padea Operator",
            "reason": "Reviewed and ready to send",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Already-sent caterer emails cannot be resent in v1."


def test_create_order_run_success_invokes_generator_and_writes_audit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = FakeClient()
    fake_client.tables["order_runs"].rows[0].update(
        {
            "service_week_start": "2026-05-01",
        }
    )
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: fake_client)

    def fake_generate_order_run(client, week_start, generated_by=None):
        assert client is fake_client
        assert week_start.isoformat() == "2026-05-01"
        assert generated_by == "Padea Operator"
        return {
            "order_run_id": "run-2",
            "status": "generated",
            "allocations": 12,
            "order_lines": 3,
            "issues": 0,
        }

    monkeypatch.setattr(backend, "generate_order_run", fake_generate_order_run)

    response = TestClient(backend.app).post(
        "/internal/order-runs",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "weekStart": "2026-05-01",
            "actorName": "Padea Operator",
            "reason": "Operator requested generation",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "orderRunId": "run-2",
        "status": "generated",
        "allocations": 12,
        "orderLines": 3,
        "issues": 0,
    }
    audit = fake_client.tables["audit_log"].rows[0]
    assert audit["action"] == "order_run_generated"
    assert audit["actor_name"] == "Padea Operator"
    assert audit["reason"] == "Operator requested generation"
    assert audit["order_run_id"] == "run-2"
    assert audit["before_state"]["superseded_order_runs"] == [
        {"id": "run-1", "status": "generated"}
    ]
    assert audit["after_state"]["allocations"] == 12


@pytest.mark.parametrize(
    ("headers", "status_code"),
    [
        ({}, 401),
        ({"Authorization": "Basic test-secret"}, 401),
        ({"Authorization": "Bearer wrong-secret"}, 403),
    ],
)
def test_create_order_run_rejects_invalid_bearer_token(
    monkeypatch: pytest.MonkeyPatch,
    headers: dict[str, str],
    status_code: int,
) -> None:
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: FakeClient())

    response = TestClient(backend.app).post(
        "/internal/order-runs",
        headers=headers,
        json={
            "weekStart": "2026-05-01",
            "actorName": "Padea Operator",
            "reason": "Operator requested generation",
        },
    )

    assert response.status_code == status_code


def test_create_order_run_rejects_invalid_payload(client: TestClient) -> None:
    response = client.post(
        "/internal/order-runs",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "weekStart": "not-a-date",
            "actorName": "Padea Operator",
        },
    )

    assert response.status_code == 422


def test_create_order_run_returns_generation_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = FakeClient()
    fake_client.tables["order_runs"].rows[0]["service_week_start"] = "2026-05-01"
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: fake_client)

    def fake_generate_order_run(*args, **kwargs):
        raise ValueError("No sessions found for week.")

    monkeypatch.setattr(backend, "generate_order_run", fake_generate_order_run)

    response = TestClient(backend.app).post(
        "/internal/order-runs",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "weekStart": "2026-05-01",
            "actorName": "Padea Operator",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "No sessions found for week."
    assert fake_client.tables["audit_log"].rows == []


def test_create_order_run_uses_default_audit_reason(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = FakeClient()
    fake_client.tables["order_runs"] = FakeTable("order_runs", [])
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: fake_client)
    monkeypatch.setattr(
        backend,
        "generate_order_run",
        lambda *args, **kwargs: {
            "order_run_id": "run-2",
            "status": "blocked",
            "allocations": 0,
            "order_lines": 0,
            "issues": 2,
        },
    )

    response = TestClient(backend.app).post(
        "/internal/order-runs",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "weekStart": "2026-05-01",
            "actorName": "Padea Operator",
            "reason": "   ",
        },
    )

    assert response.status_code == 200
    assert fake_client.tables["audit_log"].rows[0]["reason"] == "Generated order run from website."
