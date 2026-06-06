from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from padea_catering import backend
from tests.test_operations import FakeClient, FakeTable


def test_backend_lifespan_starts_embedded_worker_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    observed: dict[str, object] = {}

    class FakeThread:
        def __init__(self, *, target, kwargs, name, daemon):
            observed.update(
                {
                    "target": target,
                    "kwargs": kwargs,
                    "name": name,
                    "daemon": daemon,
                }
            )

        def start(self):
            observed["started"] = True

        def join(self, timeout):
            observed["joined"] = timeout

    monkeypatch.delenv("PADEA_EMBEDDED_AUTOMATION_WORKER", raising=False)
    monkeypatch.setattr(backend.threading, "Thread", FakeThread)

    async def exercise() -> None:
        async with backend.backend_lifespan(backend.app):
            assert observed["started"] is True
            stop_event = observed["kwargs"]["stop_event"]
            assert not stop_event.is_set()
        assert stop_event.is_set()

    asyncio.run(exercise())

    assert observed["name"] == "padea-automation-worker"
    assert observed["daemon"] is True
    assert observed["joined"] == 5


def test_backend_lifespan_can_disable_embedded_worker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PADEA_EMBEDDED_AUTOMATION_WORKER", "false")
    monkeypatch.setattr(
        backend.threading,
        "Thread",
        lambda **kwargs: pytest.fail("disabled worker must not create a thread"),
    )

    async def exercise() -> None:
        async with backend.backend_lifespan(backend.app):
            pass

    asyncio.run(exercise())


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


def test_create_autopilot_run_success_invokes_runner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = FakeClient()
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: fake_client)

    def fake_run_week_autopilot(
        client,
        week_start,
        *,
        trigger_source,
        idempotency_key,
        requested_by,
    ):
        assert client is fake_client
        assert week_start.isoformat() == "2026-05-01"
        assert trigger_source == "manual_demo"
        assert idempotency_key == "demo-key"
        assert requested_by == "Padea Operator"
        return {
            "autopilot_run_id": "autopilot-1",
            "status": "completed",
            "order_run_id": "run-2",
            "exception_count": 0,
            "emails_prepared_count": 4,
            "emails_sent_count": 4,
            "summary": "Autopilot completed.",
        }

    monkeypatch.setattr(backend, "run_week_autopilot", fake_run_week_autopilot)

    response = TestClient(backend.app).post(
        "/internal/autopilot-runs",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "weekStart": "2026-05-01",
            "triggerSource": "manual_demo",
            "idempotencyKey": "demo-key",
            "actorName": "Padea Operator",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "autopilotRunId": "autopilot-1",
        "status": "completed",
        "orderRunId": "run-2",
        "exceptionCount": 0,
        "emailsPreparedCount": 4,
        "emailsSentCount": 4,
        "summary": "Autopilot completed.",
    }


@pytest.mark.parametrize(
    ("headers", "status_code"),
    [
        ({}, 401),
        ({"Authorization": "Basic test-secret"}, 401),
        ({"Authorization": "Bearer wrong-secret"}, 403),
    ],
)
def test_create_autopilot_run_rejects_invalid_bearer_token(
    monkeypatch: pytest.MonkeyPatch,
    headers: dict[str, str],
    status_code: int,
) -> None:
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: FakeClient())

    response = TestClient(backend.app).post(
        "/internal/autopilot-runs",
        headers=headers,
        json={
            "weekStart": "2026-05-01",
            "triggerSource": "manual_demo",
            "actorName": "Padea Operator",
        },
    )

    assert response.status_code == status_code


def test_create_autopilot_run_rejects_invalid_payload(client: TestClient) -> None:
    response = client.post(
        "/internal/autopilot-runs",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "weekStart": "2026-05-01",
            "triggerSource": "bad",
            "actorName": "Padea Operator",
        },
    )

    assert response.status_code == 422


def test_create_autopilot_run_returns_runner_value_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: FakeClient())

    def fake_run_week_autopilot(*args, **kwargs):
        raise ValueError("No sessions found for week.")

    monkeypatch.setattr(backend, "run_week_autopilot", fake_run_week_autopilot)

    response = TestClient(backend.app).post(
        "/internal/autopilot-runs",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "weekStart": "2026-05-01",
            "triggerSource": "manual_demo",
            "actorName": "Padea Operator",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "No sessions found for week."


def test_enqueue_autopilot_run_returns_accepted_job(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = FakeClient()
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: fake_client)

    def fake_enqueue(client, **kwargs):
        assert client is fake_client
        assert kwargs == {
            "week_start": "2026-05-01",
            "trigger_source": "manual",
            "idempotency_key": "demo-key",
            "actor_id": "00000000-0000-0000-0000-000000000001",
            "actor_name": "Padea Operator",
        }
        return {"id": "00000000-0000-0000-0000-000000000002", "status": "queued"}, False

    monkeypatch.setattr(backend, "enqueue_autopilot_job", fake_enqueue)

    response = TestClient(backend.app).post(
        "/internal/automation-jobs/autopilot",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "weekStart": "2026-05-01",
            "triggerSource": "manual_demo",
            "idempotencyKey": "demo-key",
            "actorId": "00000000-0000-0000-0000-000000000001",
            "actorName": "Padea Operator",
        },
    )

    assert response.status_code == 202
    assert response.json() == {
        "jobId": "00000000-0000-0000-0000-000000000002",
        "status": "queued",
        "reused": False,
    }


def test_enqueue_reply_poll_reuses_active_job(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = FakeClient()
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: fake_client)
    monkeypatch.setattr(
        backend,
        "enqueue_reply_poll_job",
        lambda client, **kwargs: (
            {"id": "00000000-0000-0000-0000-000000000003", "status": "running"},
            True,
        ),
    )

    response = TestClient(backend.app).post(
        "/internal/automation-jobs/caterer-reply-poll",
        headers={"Authorization": "Bearer test-secret"},
        json={"actorName": "Padea Operator"},
    )

    assert response.status_code == 202
    assert response.json()["reused"] is True


def test_create_caterer_reply_success_invokes_handler(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = FakeClient()
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: fake_client)

    def fake_record_and_handle_caterer_reply(client, **kwargs):
        assert client is fake_client
        assert kwargs == {
            "order_run_id": "run-1",
            "caterer_id": "caterer-1",
            "raw_body": "Confirmed, thanks.",
            "communication_id": "communication-1",
            "subject": "Re: order",
            "from_email": "caterer@example.com",
            "received_at": "2026-06-05T01:02:03+00:00",
            "provider_thread_id": "thread-1",
            "provider_message_id": "message-1",
            "idempotency_key": "reply-key",
            "actor_name": "Padea Operator",
        }
        return {
            "reply_id": "reply-1",
            "ai_interpretation_id": "ai-1",
            "parsed_intent": "confirmation",
            "handled_status": "auto_handled",
            "exception_id": None,
            "summary": "Caterer confirmed the order.",
        }

    monkeypatch.setattr(
        backend,
        "record_and_handle_caterer_reply",
        fake_record_and_handle_caterer_reply,
    )

    response = TestClient(backend.app).post(
        "/internal/caterer-replies",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "run-1",
            "catererId": "caterer-1",
            "rawBody": "Confirmed, thanks.",
            "communicationId": "communication-1",
            "subject": "Re: order",
            "fromEmail": "caterer@example.com",
            "receivedAt": "2026-06-05T01:02:03+00:00",
            "providerThreadId": "thread-1",
            "providerMessageId": "message-1",
            "idempotencyKey": "reply-key",
            "actorName": "Padea Operator",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "replyId": "reply-1",
        "aiInterpretationId": "ai-1",
        "parsedIntent": "confirmation",
        "handledStatus": "auto_handled",
        "exceptionId": None,
        "summary": "Caterer confirmed the order.",
    }


@pytest.mark.parametrize(
    ("headers", "status_code"),
    [
        ({}, 401),
        ({"Authorization": "Basic test-secret"}, 401),
        ({"Authorization": "Bearer wrong-secret"}, 403),
    ],
)
def test_create_caterer_reply_rejects_invalid_bearer_token(
    monkeypatch: pytest.MonkeyPatch,
    headers: dict[str, str],
    status_code: int,
) -> None:
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: FakeClient())

    response = TestClient(backend.app).post(
        "/internal/caterer-replies",
        headers=headers,
        json={
            "orderRunId": "run-1",
            "catererId": "caterer-1",
            "rawBody": "Confirmed, thanks.",
        },
    )

    assert response.status_code == status_code


def test_create_caterer_reply_rejects_invalid_payload(client: TestClient) -> None:
    response = client.post(
        "/internal/caterer-replies",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "run-1",
            "catererId": "caterer-1",
            "rawBody": "",
        },
    )

    assert response.status_code == 422


def test_create_caterer_reply_returns_handler_value_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: FakeClient())

    def fake_record_and_handle_caterer_reply(*args, **kwargs):
        raise ValueError("order_run_id is required.")

    monkeypatch.setattr(
        backend,
        "record_and_handle_caterer_reply",
        fake_record_and_handle_caterer_reply,
    )

    response = TestClient(backend.app).post(
        "/internal/caterer-replies",
        headers={"Authorization": "Bearer test-secret"},
        json={
            "orderRunId": "run-1",
            "catererId": "caterer-1",
            "rawBody": "Confirmed, thanks.",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "order_run_id is required."


def test_poll_caterer_replies_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PADEA_BACKEND_SHARED_SECRET", "test-secret")
    monkeypatch.setattr(backend, "get_client", lambda: FakeClient())

    def fake_poll(client_arg, *, actor_name):
        assert actor_name == "Padea Operator"
        return {
            "attempt_count": 1,
            "scanned_count": 2,
            "matched_count": 2,
            "already_seen_count": 0,
            "ignored_count": 0,
            "processed_count": 2,
            "auto_handled_count": 1,
            "auto_adjusted_count": 1,
            "escalated_count": 0,
            "failed_count": 0,
            "reply_ids": ["reply-1", "reply-2"],
            "order_run_ids": ["run-1", "run-2"],
            "failed": [],
        }

    monkeypatch.setattr(backend, "poll_gmail_caterer_replies", fake_poll)

    response = TestClient(backend.app).post(
        "/internal/caterer-reply-poll",
        headers={"Authorization": "Bearer test-secret"},
        json={"actorName": "Padea Operator"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "attemptCount": 1,
        "scannedCount": 2,
        "matchedCount": 2,
        "alreadySeenCount": 0,
        "ignoredCount": 0,
        "processedCount": 2,
        "autoHandledCount": 1,
        "autoAdjustedCount": 1,
        "escalatedCount": 0,
        "failedCount": 0,
        "replyIds": ["reply-1", "reply-2"],
        "orderRunIds": ["run-1", "run-2"],
        "failed": [],
    }
