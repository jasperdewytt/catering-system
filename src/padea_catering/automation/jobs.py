"""Database-backed automation job operations."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from postgrest.exceptions import APIError

from supabase import Client

ACTIVE_JOB_STATUSES = ("queued", "running")
REPLY_SCHEDULE_KEY = "caterer_reply_poll"
FEEDBACK_SCHEDULE_KEY = "feedback_dispatch"


def utc_now() -> datetime:
    return datetime.now(UTC)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def is_requeueable_job(job: dict[str, Any], job_type: str) -> bool:
    result_status = (job.get("result") or {}).get("status")
    return job.get("status") == "failed" or (
        job_type == "autopilot_run"
        and result_status in {"blocked", "human_review_required", "failed"}
    )


def completion_progress_fields(
    job: dict[str, Any],
    result: dict[str, Any],
    *,
    failed: bool,
) -> dict[str, Any]:
    preserve_stage = result.get("status") in {"blocked", "human_review_required"}
    return {
        "current_stage": (
            "failed"
            if failed
            else job.get("current_stage", "blocked")
            if preserve_stage
            else "complete"
        ),
        "stage_label": (
            "Failed"
            if failed
            else job.get("stage_label", "Needs review")
            if preserve_stage
            else "Complete"
        ),
        "progress_percent": (job.get("progress_percent", 0) if failed or preserve_stage else 100),
    }


def _select_active(
    client: Client,
    *,
    job_type: str,
    week_start: str | None = None,
) -> list[dict[str, Any]]:
    query = (
        client.table("automation_jobs")
        .select("*")
        .eq("job_type", job_type)
        .in_("status", list(ACTIVE_JOB_STATUSES))
        .order("created_at", desc=True)
        .limit(1)
    )
    if week_start is not None:
        query = query.eq("payload->>week_start", week_start)
    return query.execute().data


def get_active_job(
    client: Client,
    *,
    job_type: str,
    week_start: str | None = None,
) -> dict[str, Any] | None:
    rows = _select_active(client, job_type=job_type, week_start=week_start)
    return rows[0] if rows else None


def _insert_audit(
    client: Client,
    *,
    job: dict[str, Any],
    action: str,
    reason: str,
    after_state: dict[str, Any] | None = None,
) -> None:
    client.table("audit_log").insert(
        {
            "order_run_id": None,
            "actor_name": job["actor_name"],
            "action": action,
            "entity_type": "automation_job",
            "entity_id": job["id"],
            "reason": reason,
            "before_state": {},
            "after_state": after_state or job,
        }
    ).execute()


def _enqueue(
    client: Client,
    *,
    job_type: str,
    idempotency_key: str,
    trigger_source: str,
    payload: dict[str, Any],
    actor_id: str | None,
    actor_name: str,
) -> tuple[dict[str, Any], bool]:
    existing = (
        client.table("automation_jobs")
        .select("*")
        .eq("idempotency_key", idempotency_key)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        job = existing[0]
        if not is_requeueable_job(job, job_type):
            return job, True
        job = (
            client.table("automation_jobs")
            .update(
                {
                    "status": "queued",
                    "current_stage": "queued",
                    "stage_label": "Queued",
                    "progress_percent": 0,
                    "counters": {},
                    "result": {},
                    "error_detail": None,
                    "actor_id": actor_id,
                    "actor_name": actor_name.strip(),
                    "available_at": utc_now_iso(),
                    "lease_owner": None,
                    "lease_expires_at": None,
                    "attempt_count": 0,
                    "started_at": None,
                    "completed_at": None,
                }
            )
            .eq("id", job["id"])
            .execute()
            .data[0]
        )
        _record_event(
            client,
            job,
            event_type="retrying",
            detail="Operator requeued a non-completed autopilot outcome.",
        )
        _insert_audit(
            client,
            job=job,
            action="automation_job_queued",
            reason="Autopilot retry queued after a non-completed outcome.",
        )
        return job, False

    try:
        job = (
            client.table("automation_jobs")
            .insert(
                {
                    "job_type": job_type,
                    "idempotency_key": idempotency_key,
                    "trigger_source": trigger_source,
                    "payload": payload,
                    "actor_id": actor_id,
                    "actor_name": actor_name.strip(),
                }
            )
            .execute()
            .data[0]
        )
    except APIError:
        active = get_active_job(
            client,
            job_type=job_type,
            week_start=payload.get("week_start"),
        )
        if active:
            return active, True
        raise

    _record_event(client, job, event_type="queued", detail="Automation job queued.")
    _insert_audit(
        client,
        job=job,
        action="automation_job_queued",
        reason=f"{job_type.replace('_', ' ').title()} queued.",
    )
    return job, False


def enqueue_autopilot_job(
    client: Client,
    *,
    week_start: str,
    trigger_source: str,
    idempotency_key: str,
    actor_id: str | None,
    actor_name: str,
) -> tuple[dict[str, Any], bool]:
    return _enqueue(
        client,
        job_type="autopilot_run",
        idempotency_key=idempotency_key,
        trigger_source=trigger_source,
        payload={
            "week_start": week_start,
            "autopilot_trigger_source": (
                "manual_demo" if trigger_source == "manual" else trigger_source
            ),
            "autopilot_idempotency_key": idempotency_key,
        },
        actor_id=actor_id,
        actor_name=actor_name,
    )


def enqueue_reply_poll_job(
    client: Client,
    *,
    trigger_source: str,
    actor_id: str | None,
    actor_name: str,
    idempotency_key: str | None = None,
) -> tuple[dict[str, Any], bool]:
    active = get_active_job(client, job_type="caterer_reply_poll")
    if active:
        return active, True
    return _enqueue(
        client,
        job_type="caterer_reply_poll",
        idempotency_key=idempotency_key or f"reply-poll:{trigger_source}:{uuid4()}",
        trigger_source=trigger_source,
        payload={},
        actor_id=actor_id,
        actor_name=actor_name,
    )


def enqueue_feedback_dispatch_job(
    client: Client,
    *,
    trigger_source: str,
    actor_id: str | None = None,
    actor_name: str = "Feedback Agent",
    idempotency_key: str | None = None,
) -> tuple[dict[str, Any], bool]:
    active = get_active_job(client, job_type="feedback_dispatch")
    if active:
        return active, True
    return _enqueue(
        client,
        job_type="feedback_dispatch",
        idempotency_key=idempotency_key or f"feedback-dispatch:{trigger_source}:{uuid4()}",
        trigger_source=trigger_source,
        payload={},
        actor_id=actor_id,
        actor_name=actor_name,
    )


def enqueue_feedback_processing_job(
    client: Client,
    *,
    feedback_type: str,
    feedback_id: str,
    actor_name: str = "Feedback Agent",
) -> tuple[dict[str, Any], bool]:
    if feedback_type not in {"student", "manager"}:
        raise ValueError("feedback_type must be student or manager.")
    return _enqueue(
        client,
        job_type="feedback_processing",
        idempotency_key=f"feedback-processing:{feedback_type}:{feedback_id}",
        trigger_source="scheduled",
        payload={"feedback_type": feedback_type, "feedback_id": feedback_id},
        actor_id=None,
        actor_name=actor_name,
    )


def _record_event(
    client: Client,
    job: dict[str, Any],
    *,
    event_type: str,
    detail: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    client.table("automation_job_events").insert(
        {
            "automation_job_id": job["id"],
            "event_type": event_type,
            "stage_code": job.get("current_stage"),
            "stage_label": job.get("stage_label"),
            "progress_percent": job.get("progress_percent"),
            "detail": detail,
            "counters": job.get("counters") or {},
            "metadata": metadata or {},
        }
    ).execute()


def update_job_progress(
    client: Client,
    job_id: str,
    *,
    stage: str,
    label: str,
    percent: int,
    counters: dict[str, Any] | None = None,
    detail: str | None = None,
    lease_seconds: int = 900,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "current_stage": stage,
        "stage_label": label,
        "progress_percent": max(0, min(100, percent)),
        "lease_expires_at": (utc_now() + timedelta(seconds=lease_seconds)).isoformat(),
    }
    if counters is not None:
        payload["counters"] = counters
    job = client.table("automation_jobs").update(payload).eq("id", job_id).execute().data[0]
    _record_event(client, job, event_type="stage_changed", detail=detail)
    return job


def complete_job(
    client: Client,
    job: dict[str, Any],
    *,
    result: dict[str, Any],
    failed: bool = False,
    error_detail: str | None = None,
) -> dict[str, Any]:
    progress_fields = completion_progress_fields(job, result, failed=failed)
    completed = (
        client.table("automation_jobs")
        .update(
            {
                "status": "failed" if failed else "completed",
                **progress_fields,
                "result": result,
                "error_detail": error_detail,
                "lease_owner": None,
                "lease_expires_at": None,
                "completed_at": utc_now_iso(),
            }
        )
        .eq("id", job["id"])
        .execute()
        .data[0]
    )
    event_type = "failed" if failed else "completed"
    _record_event(client, completed, event_type=event_type, detail=error_detail)
    _insert_audit(
        client,
        job=completed,
        action="automation_job_failed" if failed else "automation_job_completed",
        reason=error_detail or f"{job['job_type'].replace('_', ' ').title()} completed.",
        after_state=completed,
    )
    return completed


def retry_job(client: Client, job: dict[str, Any], exc: Exception) -> dict[str, Any]:
    if int(job.get("attempt_count") or 0) >= int(job.get("max_attempts") or 3):
        return complete_job(
            client,
            job,
            result={},
            failed=True,
            error_detail=str(exc) or exc.__class__.__name__,
        )
    delay_seconds = min(60, 5 * (2 ** max(int(job.get("attempt_count") or 1) - 1, 0)))
    queued = (
        client.table("automation_jobs")
        .update(
            {
                "status": "queued",
                "stage_label": "Retry queued",
                "error_detail": str(exc) or exc.__class__.__name__,
                "available_at": (utc_now() + timedelta(seconds=delay_seconds)).isoformat(),
                "lease_owner": None,
                "lease_expires_at": None,
            }
        )
        .eq("id", job["id"])
        .execute()
        .data[0]
    )
    _record_event(
        client,
        queued,
        event_type="retrying",
        detail=f"Retrying in {delay_seconds} seconds: {exc}",
    )
    return queued


def next_reply_check(
    schedule: dict[str, Any],
    *,
    now: datetime | None = None,
) -> datetime:
    now = now or utc_now()
    local_now = now.astimezone(ZoneInfo(schedule["timezone"]))
    daytime_start = datetime.strptime(schedule["daytime_start"][:8], "%H:%M:%S").time()
    daytime_end = datetime.strptime(schedule["daytime_end"][:8], "%H:%M:%S").time()
    is_daytime = daytime_start <= local_now.time() < daytime_end
    seconds = int(
        schedule["daytime_interval_seconds" if is_daytime else "overnight_interval_seconds"]
    )
    return now + timedelta(seconds=seconds)


def _heartbeat_schedule(
    client: Client,
    *,
    schedule_key: str,
    worker_id: str,
) -> dict[str, Any] | None:
    rows = (
        client.table("automation_schedules")
        .select("*")
        .eq("schedule_key", schedule_key)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return None
    schedule = rows[0]
    now = utc_now()
    client.table("automation_schedules").update({"worker_heartbeat_at": now.isoformat()}).eq(
        "schedule_key", schedule_key
    ).execute()
    if not schedule.get("enabled"):
        return None
    next_check = datetime.fromisoformat(str(schedule["next_check_at"]).replace("Z", "+00:00"))
    if next_check > now:
        return None
    if schedule_key == REPLY_SCHEDULE_KEY:
        job, _ = enqueue_reply_poll_job(
            client,
            trigger_source="scheduled",
            actor_id=None,
            actor_name="Autopilot",
            idempotency_key=f"reply-poll:scheduled:{next_check.isoformat()}",
        )
    elif schedule_key == FEEDBACK_SCHEDULE_KEY:
        job, _ = enqueue_feedback_dispatch_job(
            client,
            trigger_source="scheduled",
            actor_id=None,
            actor_name="Feedback Agent",
            idempotency_key=f"feedback-dispatch:scheduled:{next_check.isoformat()}",
        )
    else:
        return None
    client.table("automation_schedules").update(
        {
            "last_job_id": job["id"],
            "next_check_at": next_reply_check(schedule, now=now).isoformat(),
            "worker_heartbeat_at": now.isoformat(),
        }
    ).eq("schedule_key", schedule_key).execute()
    return job


def heartbeat_and_schedule(client: Client, worker_id: str) -> dict[str, Any] | None:
    reply_job = _heartbeat_schedule(client, schedule_key=REPLY_SCHEDULE_KEY, worker_id=worker_id)
    feedback_job = _heartbeat_schedule(
        client,
        schedule_key=FEEDBACK_SCHEDULE_KEY,
        worker_id=worker_id,
    )
    return reply_job or feedback_job


def update_schedule_after_job(
    client: Client,
    job: dict[str, Any],
    *,
    schedule_key: str,
    result: dict[str, Any] | None,
    error: str | None = None,
) -> None:
    rows = (
        client.table("automation_schedules")
        .select("*")
        .eq("schedule_key", schedule_key)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return
    now = utc_now()
    payload: dict[str, Any] = {
        "last_checked_at": now.isoformat(),
        "last_job_id": job["id"],
        "last_result": result or {},
        "last_error": error,
    }
    if error is None:
        payload["last_success_at"] = now.isoformat()
    client.table("automation_schedules").update(payload).eq("schedule_key", schedule_key).execute()


def update_reply_schedule_after_job(
    client: Client,
    job: dict[str, Any],
    *,
    result: dict[str, Any] | None,
    error: str | None = None,
) -> None:
    update_schedule_after_job(
        client,
        job,
        schedule_key=REPLY_SCHEDULE_KEY,
        result=result,
        error=error,
    )


def update_feedback_schedule_after_job(
    client: Client,
    job: dict[str, Any],
    *,
    result: dict[str, Any] | None,
    error: str | None = None,
) -> None:
    update_schedule_after_job(
        client,
        job,
        schedule_key=FEEDBACK_SCHEDULE_KEY,
        result=result,
        error=error,
    )
