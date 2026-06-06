"""Persistent worker for queued Padea automation jobs."""

from __future__ import annotations

import logging
import os
import socket
from datetime import date
from threading import Event
from typing import Any

from padea_catering.autopilot import run_week_autopilot
from padea_catering.db import create_service_client, get_client
from padea_catering.feedback import dispatch_due_feedback_requests, process_feedback_job
from padea_catering.replies import poll_gmail_caterer_replies
from supabase import Client

from .jobs import (
    complete_job,
    heartbeat_and_schedule,
    retry_job,
    update_feedback_schedule_after_job,
    update_job_progress,
    update_reply_schedule_after_job,
)

logger = logging.getLogger(__name__)


def worker_id() -> str:
    return os.environ.get("PADEA_AUTOMATION_WORKER_ID", "").strip() or (
        f"{socket.gethostname()}:{os.getpid()}"
    )


def claim_job(client: Client, identity: str) -> dict[str, Any] | None:
    rows = (
        client.rpc(
            "claim_automation_job",
            {"p_worker_id": identity, "p_lease_seconds": 900},
        )
        .execute()
        .data
    )
    if not rows:
        return None
    job = rows[0]
    client.table("automation_job_events").insert(
        {
            "automation_job_id": job["id"],
            "event_type": "started",
            "stage_code": job["current_stage"],
            "stage_label": job["stage_label"],
            "progress_percent": job["progress_percent"],
            "detail": f"Claimed by {identity}.",
            "counters": job.get("counters") or {},
        }
    ).execute()
    return job


def _run_autopilot(client: Client, job: dict[str, Any]) -> dict[str, Any]:
    payload = job.get("payload") or {}

    def report(
        stage: str,
        label: str,
        percent: int,
        counters: dict[str, Any] | None = None,
        detail: str | None = None,
    ) -> None:
        update_job_progress(
            client,
            job["id"],
            stage=stage,
            label=label,
            percent=percent,
            counters=counters,
            detail=detail,
        )

    result = run_week_autopilot(
        client,
        date.fromisoformat(payload["week_start"]),
        trigger_source=payload.get("autopilot_trigger_source", "manual_demo"),
        idempotency_key=payload.get("autopilot_idempotency_key"),
        requested_by=job["actor_name"],
        progress=report,
    )
    client.table("automation_jobs").update(
        {"linked_autopilot_run_id": result["autopilot_run_id"]}
    ).eq("id", job["id"]).execute()
    return result


def _run_reply_poll(client: Client, job: dict[str, Any]) -> dict[str, Any]:
    def report(
        stage: str,
        label: str,
        percent: int,
        counters: dict[str, Any] | None = None,
        detail: str | None = None,
    ) -> None:
        update_job_progress(
            client,
            job["id"],
            stage=stage,
            label=label,
            percent=percent,
            counters=counters,
            detail=detail,
        )

    return poll_gmail_caterer_replies(
        client,
        actor_name=job["actor_name"],
        progress=report,
    )


def _run_feedback_dispatch(client: Client, job: dict[str, Any]) -> dict[str, Any]:
    def report(
        stage: str,
        label: str,
        percent: int,
        counters: dict[str, Any] | None = None,
        detail: str | None = None,
    ) -> None:
        update_job_progress(
            client,
            job["id"],
            stage=stage,
            label=label,
            percent=percent,
            counters=counters,
            detail=detail,
        )

    return dispatch_due_feedback_requests(client, progress=report)


def _run_feedback_processing(client: Client, job: dict[str, Any]) -> dict[str, Any]:
    payload = job.get("payload") or {}

    def report(
        stage: str,
        label: str,
        percent: int,
        counters: dict[str, Any] | None = None,
        detail: str | None = None,
    ) -> None:
        update_job_progress(
            client,
            job["id"],
            stage=stage,
            label=label,
            percent=percent,
            counters=counters,
            detail=detail,
        )

    return process_feedback_job(
        client,
        feedback_type=payload["feedback_type"],
        feedback_id=payload["feedback_id"],
        progress=report,
    )


def execute_job(client: Client, job: dict[str, Any]) -> dict[str, Any]:
    if int(job.get("attempt_count") or 0) > int(job.get("max_attempts") or 3):
        return complete_job(
            client,
            job,
            result={},
            failed=True,
            error_detail="Automation job exceeded its retry limit after a worker interruption.",
        )
    try:
        if job["job_type"] == "autopilot_run":
            result = _run_autopilot(client, job)
            failed = result.get("status") == "failed"
            current = (
                client.table("automation_jobs")
                .select("*")
                .eq("id", job["id"])
                .limit(1)
                .execute()
                .data[0]
            )
            return complete_job(
                client,
                current,
                result=result,
                failed=failed,
                error_detail=result.get("summary") if failed else None,
            )
        if job["job_type"] == "caterer_reply_poll":
            result = _run_reply_poll(client, job)
            current = (
                client.table("automation_jobs")
                .select("*")
                .eq("id", job["id"])
                .limit(1)
                .execute()
                .data[0]
            )
            completed = complete_job(client, current, result=result)
            update_reply_schedule_after_job(client, completed, result=result)
            return completed
        if job["job_type"] == "feedback_dispatch":
            result = _run_feedback_dispatch(client, job)
            current = (
                client.table("automation_jobs")
                .select("*")
                .eq("id", job["id"])
                .limit(1)
                .execute()
                .data[0]
            )
            completed = complete_job(client, current, result=result)
            update_feedback_schedule_after_job(client, completed, result=result)
            return completed
        if job["job_type"] == "feedback_processing":
            result = _run_feedback_processing(client, job)
            current = (
                client.table("automation_jobs")
                .select("*")
                .eq("id", job["id"])
                .limit(1)
                .execute()
                .data[0]
            )
            return complete_job(client, current, result=result)
        raise ValueError(f"Unsupported automation job type {job['job_type']!r}.")
    except Exception as exc:
        if job["job_type"] == "caterer_reply_poll":
            update_reply_schedule_after_job(client, job, result=None, error=str(exc))
        if job["job_type"] == "feedback_dispatch":
            update_feedback_schedule_after_job(client, job, result=None, error=str(exc))
        return retry_job(client, job, exc)


def run_once(client: Client | None = None, *, identity: str | None = None) -> bool:
    client = client or get_client()
    identity = identity or worker_id()
    heartbeat_and_schedule(client, identity)
    job = claim_job(client, identity)
    if not job:
        return False
    execute_job(client, job)
    return True


def run_forever(
    *,
    poll_seconds: float = 1.0,
    stop_event: Event | None = None,
    identity: str | None = None,
    client: Client | None = None,
) -> None:
    client = client or create_service_client()
    identity = identity or worker_id()
    stop_event = stop_event or Event()
    while not stop_event.is_set():
        try:
            worked = run_once(client, identity=identity)
        except Exception:
            logger.exception("Automation worker loop failed; retrying after the poll interval.")
            worked = False
        if not worked:
            stop_event.wait(poll_seconds)
