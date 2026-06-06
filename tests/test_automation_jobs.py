from __future__ import annotations

from datetime import UTC, datetime

from padea_catering.automation import worker
from padea_catering.automation.jobs import (
    completion_progress_fields,
    is_requeueable_job,
    next_reply_check,
)


def _schedule() -> dict:
    return {
        "timezone": "Australia/Brisbane",
        "daytime_start": "07:00:00",
        "daytime_end": "21:00:00",
        "daytime_interval_seconds": 120,
        "overnight_interval_seconds": 600,
    }


def test_next_reply_check_uses_two_minutes_during_brisbane_daytime() -> None:
    now = datetime(2026, 6, 5, 22, 0, tzinfo=UTC)  # 8am Brisbane

    assert (next_reply_check(_schedule(), now=now) - now).total_seconds() == 120


def test_next_reply_check_uses_ten_minutes_overnight() -> None:
    now = datetime(2026, 6, 6, 12, 0, tzinfo=UTC)  # 10pm Brisbane

    assert (next_reply_check(_schedule(), now=now) - now).total_seconds() == 600


def test_exhausted_reclaimed_job_fails_without_repeating_side_effects(monkeypatch) -> None:
    completed: list[dict] = []

    def fake_complete(client, job, **kwargs):
        completed.append(kwargs)
        return {"status": "failed"}

    monkeypatch.setattr(worker, "complete_job", fake_complete)
    monkeypatch.setattr(
        worker,
        "_run_autopilot",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("exhausted job must not execute")
        ),
    )

    result = worker.execute_job(
        object(),
        {
            "id": "job-1",
            "job_type": "autopilot_run",
            "attempt_count": 4,
            "max_attempts": 3,
        },
    )

    assert result["status"] == "failed"
    assert completed[0]["failed"] is True


def test_blocked_autopilot_outcome_can_be_requeued() -> None:
    assert is_requeueable_job(
        {"status": "completed", "result": {"status": "blocked"}},
        "autopilot_run",
    )
    assert not is_requeueable_job(
        {"status": "completed", "result": {"status": "completed"}},
        "autopilot_run",
    )


def test_blocked_outcome_preserves_truthful_stopping_progress() -> None:
    fields = completion_progress_fields(
        {
            "current_stage": "blocked",
            "stage_label": "Blocked by allocation issues",
            "progress_percent": 50,
        },
        {"status": "blocked"},
        failed=False,
    )

    assert fields == {
        "current_stage": "blocked",
        "stage_label": "Blocked by allocation issues",
        "progress_percent": 50,
    }
