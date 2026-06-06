from __future__ import annotations

from datetime import date

import pytest

from padea_catering.autopilot import runner
from padea_catering.validation.framework import Finding
from tests.test_operations import FakeClient, FakeTable


def _autopilot_client() -> FakeClient:
    client = FakeClient()
    client.tables.update(
        {
            "autopilot_runs": FakeTable("autopilot_runs", []),
            "autopilot_exceptions": FakeTable("autopilot_exceptions", []),
            "order_allocations": FakeTable("order_allocations", []),
            "order_allocation_issues": FakeTable("order_allocation_issues", []),
            "order_lines": FakeTable(
                "order_lines",
                [{"id": "line-1", "order_run_id": "run-2", "session_id": "session-1"}],
            ),
            "sessions": FakeTable(
                "sessions",
                [{"id": "session-1", "caterer_id": "cat-1"}],
            ),
            "order_communications": FakeTable("order_communications", []),
        }
    )
    client.tables["order_runs"].rows[0].update(
        {
            "id": "run-1",
            "service_week_start": "2026-05-01",
            "service_week_end": "2026-05-07",
            "status": "generated",
            "issue_count": 0,
        }
    )
    return client


def _insert_generated_order_run(
    client: FakeClient,
    *,
    status: str = "generated",
    issue_count: int = 0,
) -> None:
    client.tables["order_runs"].rows.append(
        {
            "id": "run-2",
            "service_week_start": "2026-05-01",
            "service_week_end": "2026-05-07",
            "status": status,
            "issue_count": issue_count,
            "approved_at": None,
            "approved_by": None,
            "approval_note": None,
        }
    )


def _patch_clean_generation(monkeypatch: pytest.MonkeyPatch, client: FakeClient) -> None:
    def fake_generate(client_arg, week_start, generated_by=None):
        assert client_arg is client
        assert week_start == date(2026, 5, 1)
        assert generated_by == runner.AUTOPILOT_ACTOR
        _insert_generated_order_run(client)
        return {
            "order_run_id": "run-2",
            "status": "generated",
            "allocations": 10,
            "order_lines": 1,
            "issues": 0,
            "selected_offer_sets": 1,
            "fit_explanations": 10,
        }

    monkeypatch.setattr(runner, "_run_validation_gates", lambda _client: [])
    monkeypatch.setattr(runner, "generate_preference_aware_order_run", fake_generate)


def _patch_approval(monkeypatch: pytest.MonkeyPatch, client: FakeClient) -> None:
    def fake_approve(client_arg, order_run_id, actor_name, reason):
        assert client_arg is client
        assert order_run_id == "run-2"
        assert actor_name == runner.AUTOPILOT_ACTOR
        for row in client.tables["order_runs"].rows:
            if row["id"] == order_run_id:
                row.update(
                    {
                        "status": "approved",
                        "approved_by": actor_name,
                        "approved_at": "2026-06-05T00:00:00+00:00",
                        "approval_note": reason,
                    }
                )
                return row
        raise AssertionError("missing order run")

    monkeypatch.setattr(runner, "approve_order_run", fake_approve)


def _patch_snapshot_and_send(monkeypatch: pytest.MonkeyPatch, client: FakeClient) -> None:
    def fake_record_export(client_arg, *, order_run_id, caterer_id, actor_name, reason):
        assert client_arg is client
        assert order_run_id == "run-2"
        assert caterer_id == "cat-1"
        communication = {
            "id": "communication-1",
            "order_run_id": order_run_id,
            "caterer_id": caterer_id,
            "status": "exported",
        }
        client.tables["order_communications"].rows.append(communication)
        return {
            "communication": communication,
            "event": {"id": "event-1"},
            "snapshot_created": True,
        }

    def fake_send(client_arg, *, order_run_id, communication_ids, actor_name, reason):
        assert client_arg is client
        assert order_run_id == "run-2"
        assert communication_ids == ["communication-1"]
        for row in client.tables["order_communications"].rows:
            if row["id"] in communication_ids:
                row["status"] = "sent"
        return {
            "sent": [
                {
                    "communication_id": "communication-1",
                    "event_id": "event-2",
                    "status": "sent",
                    "caterer_id": "cat-1",
                    "metadata": {"provider": "fake"},
                }
            ],
            "failed": [],
        }

    monkeypatch.setattr(runner, "record_communication_export", fake_record_export)
    monkeypatch.setattr(runner, "send_caterer_emails", fake_send)


def test_clean_run_generates_approves_prepares_sends_and_completes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _autopilot_client()
    _patch_clean_generation(monkeypatch, client)
    _patch_approval(monkeypatch, client)
    _patch_snapshot_and_send(monkeypatch, client)

    result = runner.run_week_autopilot(
        client,
        date(2026, 5, 1),
        requested_by="Padea Operator",
    )

    assert result == {
        "autopilot_run_id": "autopilot_runs-1",
        "status": "completed",
        "order_run_id": "run-2",
        "exception_count": 0,
        "emails_prepared_count": 1,
        "emails_sent_count": 1,
        "summary": (
            "Autopilot completed: generated, approved, prepared, and sent test-routed emails."
        ),
    }
    assert client.tables["autopilot_runs"].rows[0]["metadata"]["requested_by"] == "Padea Operator"
    assert client.tables["order_runs"].rows[-1]["status"] == "approved"
    assert client.tables["order_communications"].rows[0]["status"] == "sent"
    assert [row["action"] for row in client.tables["audit_log"].rows] == [
        "autopilot_run_started",
        "order_run_generated",
        "autopilot_run_completed",
    ]


def test_clean_run_reports_deterministic_progress_stages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _autopilot_client()
    _patch_clean_generation(monkeypatch, client)
    _patch_approval(monkeypatch, client)
    _patch_snapshot_and_send(monkeypatch, client)
    reports: list[tuple[str, int, dict | None]] = []

    runner.run_week_autopilot(
        client,
        date(2026, 5, 1),
        progress=lambda stage, _label, percent, counters, _detail: reports.append(
            (stage, percent, counters)
        ),
    )

    assert [stage for stage, _, _ in reports] == [
        "validating",
        "generating_orders",
        "checking_allocations",
        "approving_run",
        "preparing_emails",
        "sending_emails",
        "finalizing",
    ]
    assert reports[-1][1] == 99
    assert reports[-1][2]["emails_sent"] == 1


def test_completed_idempotency_key_returns_existing_result_without_side_effects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _autopilot_client()
    client.tables["autopilot_runs"].rows.append(
        {
            "id": "autopilot-existing",
            "service_week_start": "2026-05-01",
            "idempotency_key": "autopilot:2026-05-01:manual_demo",
            "status": "completed",
            "generated_order_run_id": "run-2",
            "exception_count": 0,
            "emails_prepared_count": 1,
            "emails_sent_count": 1,
            "summary": "Already complete.",
            "metadata": {},
        }
    )
    monkeypatch.setattr(
        runner,
        "generate_preference_aware_order_run",
        lambda *args, **kwargs: pytest.fail("generator should not run"),
    )

    result = runner.run_week_autopilot(client, date(2026, 5, 1))

    assert result["autopilot_run_id"] == "autopilot-existing"
    assert result["summary"] == "Already complete."
    assert client.tables["audit_log"].rows == []


def test_retry_skips_already_sent_communications(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _autopilot_client()
    _insert_generated_order_run(client, status="approved")
    client.tables["autopilot_runs"].rows.append(
        {
            "id": "autopilot-existing",
            "service_week_start": "2026-05-01",
            "idempotency_key": "retry-key",
            "status": "failed",
            "generated_order_run_id": "run-2",
            "exception_count": 0,
            "emails_prepared_count": 1,
            "emails_sent_count": 1,
            "summary": "Previous send failure.",
            "metadata": {},
            "completed_at": "2026-06-05T00:00:00+00:00",
        }
    )
    client.tables["order_communications"].rows.append(
        {
            "id": "communication-1",
            "order_run_id": "run-2",
            "caterer_id": "cat-1",
            "status": "sent",
        }
    )
    monkeypatch.setattr(runner, "_run_validation_gates", lambda _client: [])
    monkeypatch.setattr(
        runner,
        "send_caterer_emails",
        lambda *args, **kwargs: pytest.fail("sent communication should be skipped"),
    )

    result = runner.run_week_autopilot(
        client,
        date(2026, 5, 1),
        idempotency_key="retry-key",
        trigger_source="retry",
    )

    assert result["status"] == "completed"
    assert result["emails_sent_count"] == 1
    assert client.tables["autopilot_runs"].rows[0]["status"] == "completed"


def test_validation_error_blocks_before_generation(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _autopilot_client()
    monkeypatch.setattr(
        runner,
        "_run_validation_gates",
        lambda _client: [
            Finding(
                severity="error",
                category="empty_session",
                message="Example School has no attending students.",
            )
        ],
    )
    monkeypatch.setattr(
        runner,
        "generate_preference_aware_order_run",
        lambda *args, **kwargs: pytest.fail("generator should not run"),
    )

    result = runner.run_week_autopilot(client, date(2026, 5, 1))

    assert result["status"] == "blocked"
    assert result["exception_count"] == 1
    assert client.tables["autopilot_exceptions"].rows[0]["category"] == "validation"


def test_meal_fit_blocked_run_creates_exceptions_and_skips_approval(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _autopilot_client()

    def fake_generate(*args, **kwargs):
        _insert_generated_order_run(client, status="blocked", issue_count=1)
        client.tables["order_allocation_issues"].rows.append(
            {
                "id": "issue-1",
                "order_run_id": "run-2",
                "severity": "error",
                "code": "no_safe_dish",
                "message": "Student has no safe offered dish.",
                "student_id": "student-1",
                "session_id": "session-1",
                "dish_variant_id": "variant-1",
            }
        )
        return {
            "order_run_id": "run-2",
            "status": "blocked",
            "allocations": 1,
            "order_lines": 0,
            "issues": 1,
        }

    monkeypatch.setattr(runner, "_run_validation_gates", lambda _client: [])
    monkeypatch.setattr(runner, "generate_preference_aware_order_run", fake_generate)
    monkeypatch.setattr(
        runner,
        "approve_order_run",
        lambda *args, **kwargs: pytest.fail("blocked run should not approve"),
    )

    result = runner.run_week_autopilot(client, date(2026, 5, 1))

    assert result["status"] == "blocked"
    assert client.tables["autopilot_exceptions"].rows[0]["category"] == "dietary"


def test_snapshot_preparation_failure_marks_human_review_required(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _autopilot_client()
    _patch_clean_generation(monkeypatch, client)
    _patch_approval(monkeypatch, client)
    monkeypatch.setattr(
        runner,
        "record_communication_export",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            ValueError("At least one recipient email is required before export.")
        ),
    )

    result = runner.run_week_autopilot(client, date(2026, 5, 1))

    assert result["status"] == "human_review_required"
    assert client.tables["autopilot_exceptions"].rows[0]["category"] == "email"


def test_provider_send_failure_marks_failed_and_records_email_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _autopilot_client()
    _patch_clean_generation(monkeypatch, client)
    _patch_approval(monkeypatch, client)

    def fake_record_export(client_arg, *, order_run_id, caterer_id, actor_name, reason):
        communication = {
            "id": "communication-1",
            "order_run_id": order_run_id,
            "caterer_id": caterer_id,
            "status": "exported",
        }
        client_arg.tables["order_communications"].rows.append(communication)
        return {
            "communication": communication,
            "event": {"id": "event-1"},
            "snapshot_created": True,
        }

    def fake_send(client_arg, *, order_run_id, communication_ids, actor_name, reason):
        for row in client_arg.tables["order_communications"].rows:
            row["status"] = "failed"
        return {
            "sent": [],
            "failed": [
                {
                    "communication_id": "communication-1",
                    "event_id": "event-2",
                    "status": "failed",
                    "caterer_id": "cat-1",
                    "metadata": {"provider": "fake", "error": "SMTP rejected message"},
                }
            ],
        }

    monkeypatch.setattr(runner, "record_communication_export", fake_record_export)
    monkeypatch.setattr(runner, "send_caterer_emails", fake_send)

    result = runner.run_week_autopilot(client, date(2026, 5, 1))

    assert result["status"] == "failed"
    assert client.tables["autopilot_exceptions"].rows[0]["category"] == "email"
    assert client.tables["autopilot_exceptions"].rows[0]["detail"] == "SMTP rejected message"


def test_unexpected_exception_marks_failed_with_unknown_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _autopilot_client()
    monkeypatch.setattr(runner, "_run_validation_gates", lambda _client: [])
    monkeypatch.setattr(
        runner,
        "generate_preference_aware_order_run",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )

    result = runner.run_week_autopilot(client, date(2026, 5, 1))

    assert result["status"] == "failed"
    assert client.tables["autopilot_exceptions"].rows[0]["category"] == "unknown"
    assert client.tables["autopilot_exceptions"].rows[0]["detail"] == "boom"
