"""Python-owned, idempotent autopilot orchestration for one service week."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any, Literal

from padea_catering.communications import record_communication_export, send_caterer_emails
from padea_catering.meal_fit import build_preference_aware_order_plan
from padea_catering.meal_fit.engine import generate_preference_aware_order_run
from padea_catering.operations import approve_order_run
from padea_catering.validation.checks import (
    check_dietary_warning_backlog,
    check_empty_sessions,
    check_multi_session_same_date,
)
from padea_catering.validation.framework import Finding
from supabase import Client

AUTOPILOT_ACTOR = "Autopilot"
TERMINAL_STATUSES = {"completed", "blocked", "human_review_required", "failed"}
RESUMABLE_STATUSES = {"running", "resuming", "blocked", "human_review_required", "failed"}
TRIGGER_SOURCES = {"scheduled", "manual_demo", "retry"}
EMAIL_READY_STATUSES = {"exported", "failed"}
DIETARY_ISSUE_CODES = {"pending_dietary_warning", "no_safe_dish"}

TriggerSource = Literal["scheduled", "manual_demo", "retry"]
ProgressReporter = Callable[
    [str, str, int, dict[str, Any] | None, str | None],
    None,
]


def run_week_autopilot(
    client: Client,
    week_start: date,
    trigger_source: TriggerSource = "manual_demo",
    idempotency_key: str | None = None,
    requested_by: str | None = None,
    dry_run: bool = False,
    progress: ProgressReporter | None = None,
) -> dict[str, Any]:
    """Run one service week through the final-round autopilot path.

    The runner is intentionally a coordinator. Validation, meal-fit generation,
    approval, communication rendering, and sending stay in their existing
    Python-owned modules.
    """
    if trigger_source not in TRIGGER_SOURCES:
        raise ValueError(f"trigger_source must be one of {sorted(TRIGGER_SOURCES)}.")
    key = _clean_idempotency_key(idempotency_key, week_start, trigger_source)
    requested_by = (requested_by or "").strip() or trigger_source

    if dry_run:
        return _dry_run(client, week_start, trigger_source, key, requested_by)

    run = _create_or_resume_run(
        client,
        week_start=week_start,
        trigger_source=trigger_source,
        idempotency_key=key,
        requested_by=requested_by,
    )
    if run["status"] == "completed":
        return _result_from_run(run)

    try:
        _report(progress, "validating", "Validating week", 10)
        validation_errors = [
            row for row in _run_validation_gates(client) if row.severity == "error"
        ]
        if validation_errors:
            for finding in validation_errors:
                _create_exception_once(
                    client,
                    run=run,
                    category="validation",
                    severity="blocked",
                    title=f"Validation: {finding.category}",
                    detail=finding.message,
                    recommended_action="Resolve the validation finding, then retry autopilot.",
                    metadata={"finding": _finding_metadata(finding)},
                )
            _report(
                progress,
                "blocked",
                "Blocked by validation",
                10,
                {"validation_errors": len(validation_errors)},
            )
            return _finish_run(
                client,
                run,
                status="blocked",
                summary=(
                    f"Autopilot blocked before generation by {len(validation_errors)} "
                    "validation error(s)."
                ),
            )

        _report(progress, "generating_orders", "Generating orders", 30)
        order_run_id = _ensure_meal_fit_order_run(client, run, week_start)
        run = _refresh_run(client, run["id"])
        order_run = _select_one(client, "order_runs", order_run_id)
        run_counts = _order_run_counts(client, order_run_id)
        _report(
            progress,
            "checking_allocations",
            "Checking allocations",
            50,
            run_counts,
        )
        if order_run["status"] == "blocked" or int(order_run.get("issue_count") or 0) > 0:
            issues = _select(client, "order_allocation_issues", order_run_id=order_run_id)
            for issue in issues:
                if issue.get("severity") != "error":
                    continue
                _create_exception_once(
                    client,
                    run=run,
                    category=_category_for_allocation_issue(issue),
                    severity="blocked",
                    title=f"Meal-fit: {issue.get('code') or 'allocation_issue'}",
                    detail=issue.get("message") or "Meal-fit generation produced an issue.",
                    recommended_action="Review the order allocation issue, then retry autopilot.",
                    order_run_id=order_run_id,
                    session_id=issue.get("session_id"),
                    student_id=issue.get("student_id"),
                    dish_variant_id=issue.get("dish_variant_id"),
                    metadata={"issue": issue},
                )
            _report(
                progress,
                "blocked",
                "Blocked by allocation issues",
                50,
                {**run_counts, "exceptions": _exception_count(client, run["id"])},
            )
            return _finish_run(
                client,
                run,
                status="blocked",
                order_run_id=order_run_id,
                summary="Autopilot blocked by meal-fit allocation issues.",
            )

        _report(progress, "approving_run", "Approving run", 65, run_counts)
        _ensure_order_run_approved(client, order_run_id)
        _report(progress, "preparing_emails", "Preparing emails", 75, run_counts)
        try:
            prepared = _ensure_communication_snapshots(client, run, order_run_id)
        except ValueError as exc:
            _create_exception_once(
                client,
                run=run,
                category="email",
                severity="blocked",
                title="Email snapshot preparation failed",
                detail=str(exc),
                recommended_action="Review communication prerequisites before retrying autopilot.",
                order_run_id=order_run_id,
                metadata={"error": str(exc)},
            )
            _report(
                progress,
                "blocked",
                "Email preparation needs review",
                75,
                {**run_counts, "emails_prepared": 0},
            )
            return _finish_run(
                client,
                run,
                status="human_review_required",
                order_run_id=order_run_id,
                summary=(
                    "Autopilot needs human review before communication snapshots can be prepared."
                ),
            )

        _report(
            progress,
            "sending_emails",
            "Sending emails",
            85,
            {**run_counts, "emails_prepared": prepared, "emails_sent": 0},
        )
        try:
            send_result = _send_unsent_snapshots(client, run, order_run_id)
        except ValueError as exc:
            _create_exception_once(
                client,
                run=run,
                category="email",
                severity="blocked",
                title="Email send preparation failed",
                detail=str(exc),
                recommended_action=(
                    "Review communication send prerequisites before retrying autopilot."
                ),
                order_run_id=order_run_id,
                metadata={"error": str(exc)},
            )
            _report(
                progress,
                "blocked",
                "Email sending needs review",
                85,
                {**run_counts, "emails_prepared": prepared, "emails_sent": 0},
            )
            return _finish_run(
                client,
                run,
                status="human_review_required",
                order_run_id=order_run_id,
                emails_prepared_count=prepared,
                summary="Autopilot needs human review before emails can be sent.",
            )
        if send_result["failed"]:
            for failed in send_result["failed"]:
                _create_exception_once(
                    client,
                    run=run,
                    category="email",
                    severity="blocked",
                    title=f"Email send failed: {failed['caterer_id']}",
                    detail=str(failed.get("metadata", {}).get("error") or "Provider send failed."),
                    recommended_action="Review provider configuration and retry autopilot.",
                    order_run_id=order_run_id,
                    caterer_id=failed.get("caterer_id"),
                    metadata={"send_result": failed},
                )
            _report(
                progress,
                "failed",
                "Email sending failed",
                90,
                {
                    **run_counts,
                    "emails_prepared": prepared,
                    "emails_sent": send_result["sent_count"],
                    "email_failures": len(send_result["failed"]),
                },
            )
            return _finish_run(
                client,
                run,
                status="failed",
                order_run_id=order_run_id,
                emails_prepared_count=prepared,
                emails_sent_count=send_result["sent_count"],
                summary="Autopilot failed while sending caterer email snapshots.",
            )

        _report(
            progress,
            "finalizing",
            "Finalizing run",
            99,
            {
                **run_counts,
                "emails_prepared": prepared,
                "emails_sent": send_result["sent_count"],
            },
        )
        return _finish_run(
            client,
            run,
            status="completed",
            order_run_id=order_run_id,
            emails_prepared_count=prepared,
            emails_sent_count=send_result["sent_count"],
            summary=(
                "Autopilot completed: generated, approved, prepared, and sent test-routed emails."
            ),
        )
    except Exception as exc:
        _report(progress, "failed", "Autopilot failed", 0, detail=str(exc))
        return _fail_unexpected(client, run, exc)


def _report(
    progress: ProgressReporter | None,
    stage: str,
    label: str,
    percent: int,
    counters: dict[str, Any] | None = None,
    detail: str | None = None,
) -> None:
    if progress is not None:
        progress(stage, label, percent, counters, detail)


def _dry_run(
    client: Client,
    week_start: date,
    trigger_source: str,
    idempotency_key: str,
    requested_by: str,
) -> dict[str, Any]:
    validation_errors = [row for row in _run_validation_gates(client) if row.severity == "error"]
    if validation_errors:
        return {
            "autopilot_run_id": None,
            "status": "blocked",
            "order_run_id": None,
            "exception_count": len(validation_errors),
            "emails_prepared_count": 0,
            "emails_sent_count": 0,
            "summary": (
                f"Dry run blocked by {len(validation_errors)} validation error(s) "
                f"for {week_start.isoformat()}."
            ),
            "metadata": {
                "dry_run": True,
                "trigger_source": trigger_source,
                "idempotency_key": idempotency_key,
                "requested_by": requested_by,
            },
        }

    plan = build_preference_aware_order_plan(client, week_start)
    return {
        "autopilot_run_id": None,
        "status": "blocked" if plan.has_blockers else "completed",
        "order_run_id": None,
        "exception_count": len([issue for issue in plan.issues if issue.severity == "error"]),
        "emails_prepared_count": 0,
        "emails_sent_count": 0,
        "summary": (
            "Dry run would block at meal-fit generation."
            if plan.has_blockers
            else "Dry run would complete through generation, approval, snapshots, and sending."
        ),
        "metadata": {
            "dry_run": True,
            "trigger_source": trigger_source,
            "idempotency_key": idempotency_key,
            "requested_by": requested_by,
            "offer_sets": len(plan.selected_offer_sets),
            "allocations": len(plan.allocations),
            "order_lines": 0 if plan.has_blockers else len(plan.order_lines),
            "issues": len(plan.issues),
        },
    }


def _clean_idempotency_key(
    idempotency_key: str | None,
    week_start: date,
    trigger_source: str,
) -> str:
    key = (idempotency_key or "").strip()
    if key:
        return key
    return f"autopilot:{week_start.isoformat()}:{trigger_source}"


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _select(client: Client, table: str, columns: str = "*", **eq: Any) -> list[dict[str, Any]]:
    query = client.table(table).select(columns)
    for key, value in eq.items():
        query = query.eq(key, value)
    return query.execute().data


def _select_one(client: Client, table: str, row_id: str) -> dict[str, Any]:
    rows = _select(client, table, id=row_id)
    if not rows:
        raise ValueError(f"{table} row {row_id!r} does not exist.")
    return rows[0]


def _insert_audit_log(
    client: Client,
    *,
    order_run_id: str | None,
    actor_name: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    reason: str,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return (
        client.table("audit_log")
        .insert(
            {
                "order_run_id": order_run_id,
                "actor_name": actor_name,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "reason": reason,
                "before_state": before_state or {},
                "after_state": after_state or {},
            }
        )
        .execute()
        .data[0]
    )


def _create_or_resume_run(
    client: Client,
    *,
    week_start: date,
    trigger_source: str,
    idempotency_key: str,
    requested_by: str,
) -> dict[str, Any]:
    existing = _select(client, "autopilot_runs", idempotency_key=idempotency_key)
    if existing:
        run = existing[0]
        if run["status"] == "completed":
            return run
        if run["status"] not in RESUMABLE_STATUSES:
            raise ValueError(f"Cannot resume autopilot run in status {run['status']!r}.")
        metadata = {
            **(run.get("metadata") or {}),
            "requested_by": requested_by,
            "automation_actor": AUTOPILOT_ACTOR,
            "trigger_source": trigger_source,
            "idempotency_key": idempotency_key,
            "last_resumed_at": _utc_now_iso(),
        }
        client.table("autopilot_runs").update(
            {"status": "resuming", "completed_at": None, "metadata": metadata}
        ).eq("id", run["id"]).execute()
        resumed = _refresh_run(client, run["id"])
        _insert_audit_log(
            client,
            order_run_id=resumed.get("generated_order_run_id"),
            actor_name=AUTOPILOT_ACTOR,
            action="autopilot_run_started",
            entity_type="autopilot_run",
            entity_id=resumed["id"],
            reason="Autopilot run resumed from current database state.",
            before_state=run,
            after_state=resumed,
        )
        return resumed

    metadata = {
        "requested_by": requested_by,
        "automation_actor": AUTOPILOT_ACTOR,
        "trigger_source": trigger_source,
        "idempotency_key": idempotency_key,
    }
    run = (
        client.table("autopilot_runs")
        .insert(
            {
                "service_week_start": week_start.isoformat(),
                "idempotency_key": idempotency_key,
                "status": "running",
                "trigger_source": trigger_source,
                "summary": "Autopilot run started.",
                "metadata": metadata,
            }
        )
        .execute()
        .data[0]
    )
    _insert_audit_log(
        client,
        order_run_id=None,
        actor_name=AUTOPILOT_ACTOR,
        action="autopilot_run_started",
        entity_type="autopilot_run",
        entity_id=run["id"],
        reason="Autopilot run started.",
        after_state=run,
    )
    return run


def _refresh_run(client: Client, run_id: str) -> dict[str, Any]:
    return _select_one(client, "autopilot_runs", run_id)


def _run_validation_gates(client: Client) -> list[Finding]:
    findings: list[Finding] = []
    findings.extend(check_multi_session_same_date(client))
    findings.extend(check_empty_sessions(client))
    findings.extend(check_dietary_warning_backlog(client))
    return findings


def _finding_metadata(finding: Finding) -> dict[str, Any]:
    return {
        "severity": finding.severity,
        "category": finding.category,
        "message": finding.message,
        "related": finding.related,
    }


def _supersedable_order_runs(client: Client, week_start: date) -> list[dict[str, Any]]:
    rows = _select(client, "order_runs", "id,status", service_week_start=week_start.isoformat())
    return [
        {"id": row.get("id"), "status": row.get("status")}
        for row in rows
        if row.get("status") in {"blocked", "generated"}
    ]


def _ensure_meal_fit_order_run(client: Client, run: dict[str, Any], week_start: date) -> str:
    existing_order_run_id = run.get("generated_order_run_id")
    if existing_order_run_id:
        _select_one(client, "order_runs", existing_order_run_id)
        return str(existing_order_run_id)

    superseded_runs = _supersedable_order_runs(client, week_start)
    result = generate_preference_aware_order_run(client, week_start, generated_by=AUTOPILOT_ACTOR)
    order_run_id = result["order_run_id"]
    client.table("autopilot_runs").update({"generated_order_run_id": order_run_id}).eq(
        "id", run["id"]
    ).execute()
    _insert_audit_log(
        client,
        order_run_id=order_run_id,
        actor_name=AUTOPILOT_ACTOR,
        action="order_run_generated",
        entity_type="order_run",
        entity_id=order_run_id,
        reason="Autopilot generated a meal-fit order run.",
        before_state={
            "week_start": week_start.isoformat(),
            "superseded_order_runs": superseded_runs,
        },
        after_state={
            "week_start": week_start.isoformat(),
            "autopilot_run_id": run["id"],
            **result,
        },
    )
    return str(order_run_id)


def _order_run_counts(client: Client, order_run_id: str) -> dict[str, int]:
    return {
        "allocations": len(_select(client, "order_allocations", "id", order_run_id=order_run_id)),
        "order_lines": len(_select(client, "order_lines", "id", order_run_id=order_run_id)),
        "allocation_issues": len(
            _select(client, "order_allocation_issues", "id", order_run_id=order_run_id)
        ),
    }


def _ensure_order_run_approved(client: Client, order_run_id: str) -> None:
    order_run = _select_one(client, "order_runs", order_run_id)
    if order_run["status"] == "approved":
        return
    approve_order_run(
        client,
        order_run_id,
        actor_name=AUTOPILOT_ACTOR,
        reason="Autopilot approved a clean generated meal-fit run.",
    )


def _ensure_communication_snapshots(
    client: Client,
    run: dict[str, Any],
    order_run_id: str,
) -> int:
    caterer_ids = _caterer_ids_for_order_run(client, order_run_id)
    existing = {
        row["caterer_id"]: row
        for row in _select(client, "order_communications", "*", order_run_id=order_run_id)
    }
    for caterer_id in caterer_ids:
        if caterer_id in existing:
            continue
        record_communication_export(
            client,
            order_run_id=order_run_id,
            caterer_id=caterer_id,
            actor_name=AUTOPILOT_ACTOR,
            reason="Autopilot prepared immutable caterer email snapshot.",
        )
    prepared = len(_select(client, "order_communications", "id", order_run_id=order_run_id))
    client.table("autopilot_runs").update({"emails_prepared_count": prepared}).eq(
        "id", run["id"]
    ).execute()
    return prepared


def _caterer_ids_for_order_run(client: Client, order_run_id: str) -> list[str]:
    order_lines = _select(client, "order_lines", "session_id", order_run_id=order_run_id)
    session_ids = {row.get("session_id") for row in order_lines if row.get("session_id")}
    sessions = {
        row["id"]: row["caterer_id"] for row in _select(client, "sessions", "id,caterer_id")
    }
    return sorted({sessions[session_id] for session_id in session_ids if session_id in sessions})


def _send_unsent_snapshots(
    client: Client,
    run: dict[str, Any],
    order_run_id: str,
) -> dict[str, Any]:
    communications = _select(client, "order_communications", "*", order_run_id=order_run_id)
    unsent_ids = [row["id"] for row in communications if row.get("status") in EMAIL_READY_STATUSES]
    if unsent_ids:
        result = send_caterer_emails(
            client,
            order_run_id=order_run_id,
            communication_ids=unsent_ids,
            actor_name=AUTOPILOT_ACTOR,
            reason="Autopilot sent test-routed caterer email snapshots.",
        )
    else:
        result = {"sent": [], "failed": []}

    sent_count = len(
        [
            row
            for row in _select(
                client, "order_communications", "id,status", order_run_id=order_run_id
            )
            if row.get("status") == "sent"
        ]
    )
    client.table("autopilot_runs").update({"emails_sent_count": sent_count}).eq(
        "id", run["id"]
    ).execute()
    return {"sent": result["sent"], "failed": result["failed"], "sent_count": sent_count}


def _create_exception_once(
    client: Client,
    *,
    run: dict[str, Any],
    category: str,
    severity: str,
    title: str,
    detail: str,
    recommended_action: str,
    order_run_id: str | None = None,
    student_id: str | None = None,
    session_id: str | None = None,
    caterer_id: str | None = None,
    dish_variant_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    existing = _select(
        client,
        "autopilot_exceptions",
        "*",
        autopilot_run_id=run["id"],
        category=category,
        title=title,
    )
    if existing:
        return existing[0]

    row = (
        client.table("autopilot_exceptions")
        .insert(
            {
                "autopilot_run_id": run["id"],
                "service_week_start": run["service_week_start"],
                "severity": severity,
                "category": category,
                "title": title,
                "detail": detail,
                "recommended_action": recommended_action,
                "student_id": student_id,
                "session_id": session_id,
                "caterer_id": caterer_id,
                "order_run_id": order_run_id,
                "dish_variant_id": dish_variant_id,
                "metadata": metadata or {},
            }
        )
        .execute()
        .data[0]
    )
    _insert_audit_log(
        client,
        order_run_id=order_run_id,
        actor_name=AUTOPILOT_ACTOR,
        action="autopilot_exception_created",
        entity_type="autopilot_exception",
        entity_id=row["id"],
        reason=title,
        before_state={},
        after_state=row,
    )
    client.table("autopilot_runs").update(
        {"exception_count": _exception_count(client, run["id"])}
    ).eq("id", run["id"]).execute()
    return row


def _exception_count(client: Client, run_id: str) -> int:
    return len(_select(client, "autopilot_exceptions", "id", autopilot_run_id=run_id))


def _category_for_allocation_issue(issue: dict[str, Any]) -> str:
    return "dietary" if issue.get("code") in DIETARY_ISSUE_CODES else "meal_fit"


def _finish_run(
    client: Client,
    run: dict[str, Any],
    *,
    status: str,
    summary: str,
    order_run_id: str | None = None,
    emails_prepared_count: int | None = None,
    emails_sent_count: int | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "status": status,
        "summary": summary,
        "exception_count": _exception_count(client, run["id"]),
    }
    if status in TERMINAL_STATUSES:
        payload["completed_at"] = _utc_now_iso()
    if order_run_id is not None:
        payload["generated_order_run_id"] = order_run_id
    if emails_prepared_count is not None:
        payload["emails_prepared_count"] = emails_prepared_count
    if emails_sent_count is not None:
        payload["emails_sent_count"] = emails_sent_count

    before = _refresh_run(client, run["id"])
    client.table("autopilot_runs").update(payload).eq("id", run["id"]).execute()
    after = _refresh_run(client, run["id"])
    _insert_audit_log(
        client,
        order_run_id=after.get("generated_order_run_id"),
        actor_name=AUTOPILOT_ACTOR,
        action="autopilot_run_completed",
        entity_type="autopilot_run",
        entity_id=after["id"],
        reason=summary,
        before_state=before,
        after_state=after,
    )
    return _result_from_run(after)


def _result_from_run(run: dict[str, Any]) -> dict[str, Any]:
    return {
        "autopilot_run_id": run["id"],
        "status": run["status"],
        "order_run_id": run.get("generated_order_run_id"),
        "exception_count": int(run.get("exception_count") or 0),
        "emails_prepared_count": int(run.get("emails_prepared_count") or 0),
        "emails_sent_count": int(run.get("emails_sent_count") or 0),
        "summary": run.get("summary") or "",
    }


def _fail_unexpected(client: Client, run: dict[str, Any], exc: Exception) -> dict[str, Any]:
    try:
        _create_exception_once(
            client,
            run=run,
            category="unknown",
            severity="critical",
            title="Unexpected autopilot error",
            detail=str(exc) or exc.__class__.__name__,
            recommended_action="Inspect backend logs and retry after the defect is resolved.",
            order_run_id=run.get("generated_order_run_id"),
            metadata={"exception_type": exc.__class__.__name__},
        )
    except Exception:
        pass
    return _finish_run(
        client,
        run,
        status="failed",
        order_run_id=run.get("generated_order_run_id"),
        summary="Autopilot failed because the runner hit an unexpected error.",
    )
