"""Backend-owned feedback request, submission, and processing service."""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from email.utils import make_msgid
from typing import Any
from zoneinfo import ZoneInfo

from postgrest.exceptions import APIError

from padea_catering.communications.actions import EmailDeliveryError, email_provider_from_env
from padea_catering.llm import interpret_manager_feedback, interpret_student_feedback
from padea_catering.llm.taxonomy import CANONICAL_PREFERENCE_TAGS
from supabase import Client

from .tokens import sign_feedback_request, verify_feedback_token

BRISBANE = ZoneInfo("Australia/Brisbane")
REQUEST_WINDOW_DAYS = 21
EXPIRY_DAYS = 8
STUDENT_RATING_REQUIRED = "Rating is required."
SERIOUS_DELIVERY_STATUSES = {"missing_items", "wrong_items", "not_delivered"}
REVIEW_DELIVERY_STATUSES = {"late"}


def utc_now() -> datetime:
    return datetime.now(UTC)


def _select(client: Client, table: str, columns: str = "*", **eq: Any) -> list[dict[str, Any]]:
    query = client.table(table).select(columns)
    for key, value in eq.items():
        query = query.eq(key, value)
    return query.execute().data


def _select_one(client: Client, table: str, row_id: str, columns: str = "*") -> dict[str, Any]:
    rows = _select(client, table, columns, id=row_id)
    if not rows:
        raise ValueError(f"{table} row {row_id!r} does not exist.")
    return rows[0]


def _in_filter(
    client: Client, table: str, columns: str, column: str, values: set[str]
) -> list[dict[str, Any]]:
    if not values:
        return []
    return client.table(table).select(columns).in_(column, sorted(values)).execute().data


def _insert_audit(
    client: Client,
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    reason: str,
    after_state: dict[str, Any],
    actor_name: str = "Feedback Agent",
) -> None:
    client.table("audit_log").insert(
        {
            "order_run_id": after_state.get("order_run_id"),
            "actor_name": actor_name,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "reason": reason,
            "before_state": {},
            "after_state": after_state,
        }
    ).execute()


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _parse_time(value: str | None) -> time | None:
    if not value:
        return None
    raw = str(value).strip()
    for pattern in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(raw, pattern).time()
        except ValueError:
            continue
    return None


def _eligible_at(session: dict[str, Any]) -> datetime:
    session_date = date.fromisoformat(str(session["session_date"]))
    candidate = _parse_time(session.get("dinner_time"))
    offset = timedelta(minutes=25)
    if candidate is None:
        candidate = _parse_time(session.get("end_time"))
        offset = -timedelta(minutes=5)
    if candidate is None:
        candidate = time(hour=18)
        offset = timedelta()
    return datetime.combine(session_date, candidate, tzinfo=BRISBANE) + offset


def _request_times(session: dict[str, Any]) -> tuple[str, str]:
    eligible = _eligible_at(session).astimezone(UTC)
    return eligible.isoformat(), (eligible + timedelta(days=EXPIRY_DAYS)).isoformat()


def _latest_candidate_order_runs(client: Client, *, now: datetime) -> list[dict[str, Any]]:
    cutoff = (now.astimezone(BRISBANE).date() - timedelta(days=REQUEST_WINDOW_DAYS)).isoformat()
    rows = (
        client.table("order_runs")
        .select("id,service_week_start,status,generated_at")
        .gte("service_week_start", cutoff)
        .in_("status", ["approved", "generated"])
        .order("service_week_start", desc=True)
        .order("generated_at", desc=True)
        .execute()
        .data
    )
    by_week: dict[str, dict[str, Any]] = {}
    for row in rows:
        by_week.setdefault(str(row["service_week_start"]), row)
    return list(by_week.values())


def ensure_feedback_requests(client: Client, *, now: datetime | None = None) -> dict[str, int]:
    """Create missing request rows for recent generated/approved allocated meals."""
    now = now or utc_now()
    created_student = 0
    created_manager = 0
    for run in _latest_candidate_order_runs(client, now=now):
        allocations = _select(
            client,
            "order_allocations",
            "id,order_run_id,session_id,student_id,dish_variant_id,status",
            order_run_id=run["id"],
        )
        allocated = [row for row in allocations if row.get("status") == "allocated"]
        session_ids = {row["session_id"] for row in allocated}
        student_ids = {row["student_id"] for row in allocated}
        sessions = {
            row["id"]: row
            for row in _in_filter(
                client,
                "sessions",
                "id,session_date,start_time,end_time,dinner_time,caterer_id,manager_name",
                "id",
                session_ids,
            )
        }
        students = {
            row["id"]: row
            for row in _in_filter(
                client, "students", "id,full_name,student_email", "id", student_ids
            )
        }

        for session_id, session in sessions.items():
            if _select(
                client, "feedback_requests", "id", audience="session_manager", session_id=session_id
            ):
                continue
            eligible_at, expires_at = _request_times(session)
            row = (
                client.table("feedback_requests")
                .insert(
                    {
                        "audience": "session_manager",
                        "order_run_id": run["id"],
                        "session_id": session_id,
                        "caterer_id": session["caterer_id"],
                        "eligible_at": eligible_at,
                        "expires_at": expires_at,
                        "metadata": {"created_by": "feedback_dispatch"},
                    }
                )
                .execute()
                .data[0]
            )
            created_manager += 1
            _insert_audit(
                client,
                action="feedback_request_created",
                entity_type="feedback_request",
                entity_id=row["id"],
                reason="Created session-manager feedback request.",
                after_state=row,
            )

        for allocation in allocated:
            session = sessions.get(allocation["session_id"])
            student = students.get(allocation["student_id"])
            if not session or not student or not student.get("student_email"):
                continue
            if _select(
                client,
                "feedback_requests",
                "id",
                audience="student",
                order_allocation_id=allocation["id"],
            ):
                continue
            eligible_at, expires_at = _request_times(session)
            row = (
                client.table("feedback_requests")
                .insert(
                    {
                        "audience": "student",
                        "order_run_id": run["id"],
                        "session_id": allocation["session_id"],
                        "order_allocation_id": allocation["id"],
                        "student_id": allocation["student_id"],
                        "caterer_id": session["caterer_id"],
                        "email_to": student["student_email"],
                        "eligible_at": eligible_at,
                        "expires_at": expires_at,
                        "metadata": {
                            "created_by": "feedback_dispatch",
                            "dish_variant_id": allocation.get("dish_variant_id"),
                        },
                    }
                )
                .execute()
                .data[0]
            )
            created_student += 1
            _insert_audit(
                client,
                action="feedback_request_created",
                entity_type="feedback_request",
                entity_id=row["id"],
                reason="Created student meal feedback request.",
                after_state=row,
            )
    return {
        "student_requests_created": created_student,
        "manager_requests_created": created_manager,
    }


def _web_base_url() -> str:
    return (
        os.environ.get("PADEA_WEB_PUBLIC_URL", "").strip()
        or os.environ.get("NEXT_PUBLIC_SITE_URL", "").strip()
        or "http://localhost:3000"
    ).rstrip("/")


def feedback_link_for_request(request_id: str, audience: str | None = None) -> str:
    request_id = str(request_id)
    token = sign_feedback_request(request_id)
    if audience == "session_manager":
        return f"{_web_base_url()}/feedback/session/{token}"
    if audience == "student":
        return f"{_web_base_url()}/feedback/student/{token}"
    return f"{_web_base_url()}/feedback/{token}"


def _format_date(value: str | None) -> str:
    if not value:
        return "the session"
    parsed = date.fromisoformat(value)
    return parsed.strftime("%A %-d %B")


def _request_context(client: Client, request: dict[str, Any]) -> dict[str, Any]:
    session = _select_one(
        client,
        "sessions",
        request["session_id"],
        "id,session_date,dinner_time,manager_name,school_id,caterer_id",
    )
    school = _select_one(client, "schools", session["school_id"], "id,canonical_name")
    caterer = _select_one(
        client, "caterers", request["caterer_id"] or session["caterer_id"], "id,name"
    )
    student = (
        _select_one(client, "students", request["student_id"], "id,full_name")
        if request.get("student_id")
        else None
    )
    allocation = (
        _select_one(
            client,
            "order_allocations",
            request["order_allocation_id"],
            "id,dish_variant_id",
        )
        if request.get("order_allocation_id")
        else None
    )
    variant = None
    dish = None
    if allocation and allocation.get("dish_variant_id"):
        variant = _select_one(
            client, "dish_variants", allocation["dish_variant_id"], "id,dish_id,name,is_default"
        )
        dish = _select_one(client, "dishes", variant["dish_id"], "id,name")
    dish_name = None
    if dish and variant:
        dish_name = (
            dish["name"] if variant.get("is_default") else f"{dish['name']} - {variant['name']}"
        )
    return {
        "requestId": request["id"],
        "audience": request["audience"],
        "status": request["status"],
        "schoolName": school["canonical_name"],
        "sessionDate": session["session_date"],
        "sessionDateLabel": _format_date(session["session_date"]),
        "catererName": caterer["name"],
        "studentName": student["full_name"] if student else None,
        "dishName": dish_name,
        "managerName": session.get("manager_name"),
        "expiresAt": request["expires_at"],
        "submittedAt": request.get("submitted_at"),
    }


def _load_request_from_token(client: Client, token: str) -> dict[str, Any]:
    request_id = verify_feedback_token(token)
    request = _select_one(client, "feedback_requests", request_id)
    expires_at = _parse_iso_datetime(request.get("expires_at"))
    if (
        request.get("status") not in {"submitted", "expired"}
        and expires_at
        and expires_at <= utc_now()
    ):
        request = (
            client.table("feedback_requests")
            .update({"status": "expired", "last_error": "Feedback link expired."})
            .eq("id", request["id"])
            .execute()
            .data[0]
        )
    return request


def get_feedback_request_context(
    client: Client, token: str, *, expected_audience: str
) -> dict[str, Any]:
    request = _load_request_from_token(client, token)
    if request["audience"] != expected_audience:
        raise ValueError("Feedback link does not match this form.")
    return _request_context(client, request)


def dispatch_due_feedback_requests(
    client: Client,
    *,
    now: datetime | None = None,
    progress: Any | None = None,
) -> dict[str, Any]:
    now = now or utc_now()
    created = ensure_feedback_requests(client, now=now)
    if progress:
        progress("feedback_requests", "Creating feedback requests", 25, created)
    due = (
        client.table("feedback_requests")
        .select("*")
        .eq("audience", "student")
        .in_("status", ["pending", "failed"])
        .lte("eligible_at", now.isoformat())
        .gt("expires_at", now.isoformat())
        .eq("send_count", 0)
        .order("eligible_at", desc=False)
        .limit(50)
        .execute()
        .data
    )
    sent = 0
    failed = 0
    skipped = 0
    provider = None
    if due:
        try:
            provider = email_provider_from_env()
        except ValueError:
            provider = None
    for request in due:
        if not request.get("email_to"):
            skipped += 1
            _record_delivery_attempt(client, request, "skipped", error="Student email missing.")
            continue
        context = _request_context(client, request)
        link = feedback_link_for_request(request["id"], "student")
        subject = f"Quick Padea meal feedback - {context['sessionDateLabel']}"
        body = _student_invitation_body(context, link)
        message_id = make_msgid(domain="feedback.padea")
        try:
            if provider is None:
                raise EmailDeliveryError("Feedback email provider is not configured.")
            metadata = provider.send(
                subject=subject,
                body=body,
                to_emails=[request["email_to"]],
                message_id=message_id,
            )
        except Exception as exc:
            failed += 1
            updated = (
                client.table("feedback_requests")
                .update(
                    {
                        "status": "failed",
                        "send_count": int(request.get("send_count") or 0) + 1,
                        "last_error": str(exc),
                    }
                )
                .eq("id", request["id"])
                .execute()
                .data[0]
            )
            _record_delivery_attempt(
                client, updated, "failed", error=str(exc), message_id=message_id
            )
            _insert_audit(
                client,
                action="feedback_invitation_failed",
                entity_type="feedback_request",
                entity_id=request["id"],
                reason="Student feedback invitation failed.",
                after_state=updated,
            )
            continue
        sent += 1
        updated = (
            client.table("feedback_requests")
            .update(
                {
                    "status": "sent",
                    "sent_at": now.isoformat(),
                    "send_count": int(request.get("send_count") or 0) + 1,
                    "last_error": None,
                }
            )
            .eq("id", request["id"])
            .execute()
            .data[0]
        )
        _record_delivery_attempt(client, updated, "sent", metadata=metadata, message_id=message_id)
        _insert_audit(
            client,
            action="feedback_invitation_sent",
            entity_type="feedback_request",
            entity_id=request["id"],
            reason="Student feedback invitation sent.",
            after_state=updated,
        )
    result = {**created, "sent": sent, "failed": failed, "skipped": skipped}
    if progress:
        progress("feedback_dispatch_complete", "Feedback dispatch complete", 100, result)
    return result


def _record_delivery_attempt(
    client: Client,
    request: dict[str, Any],
    status: str,
    *,
    error: str | None = None,
    metadata: dict[str, Any] | None = None,
    message_id: str | None = None,
) -> None:
    metadata = metadata or {}
    actual = metadata.get("actual_recipients") or []
    client.table("feedback_delivery_attempts").insert(
        {
            "feedback_request_id": request["id"],
            "channel": "email",
            "status": status,
            "provider": metadata.get("provider"),
            "message_id": metadata.get("message_id") or message_id,
            "requested_recipient": request.get("email_to"),
            "actual_recipient": actual[0] if actual else None,
            "error_detail": error,
            "metadata": metadata,
        }
    ).execute()


def _student_invitation_body(context: dict[str, Any], link: str) -> str:
    dish = context.get("dishName") or "your meal"
    return (
        f"Hi {context.get('studentName') or 'there'},\n\n"
        f"How was {dish} from {context['catererName']} at "
        f"{context['schoolName']} on {context['sessionDateLabel']}?\n\n"
        f"Please leave quick feedback here:\n{link}\n\n"
        "This helps Padea choose better meals in future weeks.\n"
    )


def _queue_processing(client: Client, *, feedback_type: str, feedback_id: str) -> None:
    from padea_catering.automation import enqueue_feedback_processing_job

    enqueue_feedback_processing_job(
        client,
        feedback_type=feedback_type,
        feedback_id=feedback_id,
        actor_name="Feedback Agent",
    )


def submit_student_feedback(
    client: Client,
    *,
    token: str,
    rating: int,
    free_text: str | None = None,
    requested_food: str | None = None,
) -> dict[str, Any]:
    request = _load_request_from_token(client, token)
    if request["audience"] != "student":
        raise ValueError("Feedback link does not match the student form.")
    _ensure_request_submittable(request)
    if rating < 1 or rating > 5:
        raise ValueError(STUDENT_RATING_REQUIRED)
    allocation = _select_one(
        client,
        "order_allocations",
        request["order_allocation_id"],
        "id,dish_variant_id",
    )
    row = (
        client.table("student_meal_feedback")
        .insert(
            {
                "student_id": request["student_id"],
                "session_id": request["session_id"],
                "dish_variant_id": allocation.get("dish_variant_id"),
                "order_allocation_id": request["order_allocation_id"],
                "rating": rating,
                "liked": True if rating >= 4 else False if rating <= 2 else None,
                "free_text": (free_text or "").strip() or None,
                "requested_food": (requested_food or "").strip() or None,
                "source": "student_form",
                "metadata": {"feedback_request_id": request["id"]},
            }
        )
        .execute()
        .data[0]
    )
    updated = _mark_submitted(client, request, {"response_student_feedback_id": row["id"]})
    _insert_audit(
        client,
        action="feedback_recorded",
        entity_type="student_meal_feedback",
        entity_id=row["id"],
        reason="Student submitted meal feedback.",
        after_state={**row, "order_run_id": request.get("order_run_id")},
        actor_name="Student Feedback Form",
    )
    _queue_processing(client, feedback_type="student", feedback_id=row["id"])
    return {"request": updated, "feedback": row}


def submit_manager_feedback(
    client: Client,
    *,
    token: str,
    everything_ok: bool,
    delivery_status: str | None = None,
    food_quality_rating: int | None = None,
    leftover_level: str | None = None,
    issue_tags: list[str] | None = None,
    manager_notes: str | None = None,
) -> dict[str, Any]:
    request = _load_request_from_token(client, token)
    if request["audience"] != "session_manager":
        raise ValueError("Feedback link does not match the session-manager form.")
    _ensure_request_submittable(request)
    cleaned_tags = [tag for tag in (issue_tags or []) if tag]
    notes = (manager_notes or "").strip() or None
    if everything_ok:
        delivery_status = "on_time"
        food_quality_rating = food_quality_rating or 5
        leftover_level = leftover_level or "none"
        cleaned_tags = []
    elif not cleaned_tags and not notes:
        raise ValueError("Add at least one issue or a note when everything was not okay.")
    row = (
        client.table("session_catering_feedback")
        .insert(
            {
                "session_id": request["session_id"],
                "caterer_id": request["caterer_id"],
                "delivery_status": delivery_status or "unknown",
                "food_quality_rating": food_quality_rating,
                "leftover_level": leftover_level or "unknown",
                "issue_tags": cleaned_tags,
                "manager_notes": notes,
                "source": "manager_form",
                "metadata": {
                    "feedback_request_id": request["id"],
                    "everything_ok": everything_ok,
                },
            }
        )
        .execute()
        .data[0]
    )
    updated = _mark_submitted(client, request, {"response_session_feedback_id": row["id"]})
    _insert_audit(
        client,
        action="feedback_recorded",
        entity_type="session_catering_feedback",
        entity_id=row["id"],
        reason="Session manager submitted catering feedback.",
        after_state={**row, "order_run_id": request.get("order_run_id")},
        actor_name="Manager Feedback Form",
    )
    _queue_processing(client, feedback_type="manager", feedback_id=row["id"])
    return {"request": updated, "feedback": row}


def _ensure_request_submittable(request: dict[str, Any]) -> None:
    if request.get("status") == "submitted":
        raise ValueError("Feedback has already been submitted for this link.")
    if request.get("status") == "expired":
        raise ValueError("Feedback link has expired.")


def _mark_submitted(
    client: Client,
    request: dict[str, Any],
    payload: dict[str, Any],
) -> dict[str, Any]:
    return (
        client.table("feedback_requests")
        .update({"status": "submitted", "submitted_at": utc_now().isoformat(), **payload})
        .eq("id", request["id"])
        .execute()
        .data[0]
    )


def process_feedback_job(
    client: Client,
    *,
    feedback_type: str,
    feedback_id: str,
    progress: Any | None = None,
) -> dict[str, Any]:
    if progress:
        progress("feedback_ai", "Interpreting feedback", 20, {"feedback_id": feedback_id})
    ai_row = _try_interpret_feedback(client, feedback_type=feedback_type, feedback_id=feedback_id)
    if progress:
        progress("feedback_signals", "Updating quality and preference signals", 65, {})
    if feedback_type == "student":
        row = _select_one(client, "student_meal_feedback", feedback_id)
        signal_count = recompute_student_preference_signals(client, row["student_id"])
        quality_count = record_student_quality_patterns(client, row, ai_row)
        result = {
            "status": "processed",
            "preference_signals": signal_count,
            "quality_events": quality_count,
        }
    elif feedback_type == "manager":
        row = _select_one(client, "session_catering_feedback", feedback_id)
        quality_count = record_manager_quality_events(client, row, ai_row)
        result = {"status": "processed", "quality_events": quality_count}
    else:
        raise ValueError(f"Unsupported feedback type {feedback_type!r}.")
    _insert_audit(
        client,
        action="feedback_processed",
        entity_type=f"{feedback_type}_feedback",
        entity_id=feedback_id,
        reason="Feedback processing completed.",
        after_state=result,
    )
    if progress:
        progress("feedback_processed", "Feedback processing complete", 100, result)
    return result


def _try_interpret_feedback(
    client: Client,
    *,
    feedback_type: str,
    feedback_id: str,
) -> dict[str, Any] | None:
    try:
        if feedback_type == "student":
            return interpret_student_feedback(client, feedback_id)
        if feedback_type == "manager":
            return interpret_manager_feedback(client, feedback_id)
    except Exception as exc:
        _insert_audit(
            client,
            action="feedback_processing_failed",
            entity_type=f"{feedback_type}_feedback",
            entity_id=feedback_id,
            reason=f"AI interpretation skipped or failed: {exc}",
            after_state={"feedback_id": feedback_id, "error": str(exc)},
        )
    return None


def _variant_tags(client: Client, variant_id: str | None) -> set[str]:
    if not variant_id:
        return set()
    rows = _select(client, "dish_variant_tags", "tag_code", dish_variant_id=variant_id)
    return {row["tag_code"] for row in rows if row.get("tag_code") in CANONICAL_PREFERENCE_TAGS}


def _variant_display_rows(client: Client) -> list[dict[str, Any]]:
    return client.table("dish_variants").select("id,name,is_default,dishes(id,name)").execute().data


def _exact_requested_variant_id(client: Client, requested_food: str | None) -> str | None:
    cleaned = (requested_food or "").strip().lower()
    if not cleaned:
        return None
    for row in _variant_display_rows(client):
        dish = row.get("dishes") or {}
        dish_name = str(dish.get("name") or "")
        display = dish_name if row.get("is_default") else f"{dish_name} - {row.get('name')}"
        if cleaned == display.strip().lower() or cleaned == dish_name.strip().lower():
            return row["id"]
    return None


def _feedback_age_weight(created_at: str | None, *, now: datetime | None = None) -> float:
    now = now or utc_now()
    observed = _parse_iso_datetime(created_at) or now
    days = max(0.0, (now - observed).total_seconds() / 86400.0)
    return 0.5 ** (days / 56.0)


def recompute_student_preference_signals(client: Client, student_id: str) -> int:
    rows = _select(
        client,
        "student_meal_feedback",
        "id,dish_variant_id,rating,liked,requested_food,created_at",
        student_id=student_id,
    )
    contributions: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        weight = _feedback_age_weight(row.get("created_at"))
        if row.get("liked") is True:
            for tag in _variant_tags(client, row.get("dish_variant_id")):
                contributions[tag].append(1.0 * weight)
        elif row.get("liked") is False:
            for tag in _variant_tags(client, row.get("dish_variant_id")):
                contributions[tag].append(-1.0 * weight)

        exact_variant_id = _exact_requested_variant_id(client, row.get("requested_food"))
        for tag in _variant_tags(client, exact_variant_id):
            contributions[tag].append(0.75 * weight)

        ai_rows = _select(
            client,
            "ai_interpretations",
            "parsed_output,confidence,needs_human_review",
            student_meal_feedback_id=row["id"],
        )
        for ai_row in ai_rows:
            if ai_row.get("needs_human_review") or float(ai_row.get("confidence") or 0) < 0.7:
                continue
            parsed = ai_row.get("parsed_output") or {}
            for tag in parsed.get("liked_tags") or []:
                if tag in CANONICAL_PREFERENCE_TAGS and tag != "other_for_review":
                    contributions[tag].append(1.0 * weight)
            for tag in parsed.get("disliked_tags") or []:
                if tag in CANONICAL_PREFERENCE_TAGS and tag != "other_for_review":
                    contributions[tag].append(-1.0 * weight)
            for tag in parsed.get("requested_tags") or []:
                if tag in CANONICAL_PREFERENCE_TAGS and tag != "other_for_review":
                    contributions[tag].append(0.75 * weight)

    written = 0
    for tag, values in contributions.items():
        if not values:
            continue
        total_abs = sum(abs(value) for value in values)
        score = max(-1.0, min(1.0, sum(values) / max(total_abs, 0.001)))
        confidence = min(1.0, total_abs / 3.0)
        payload = {
            "student_id": student_id,
            "tag_code": tag,
            "affinity_score": round(score, 4),
            "confidence": round(confidence, 4),
            "feedback_count": len(values),
            "last_observed_at": utc_now().isoformat(),
        }
        client.table("student_preference_signals").upsert(
            payload,
            on_conflict="student_id,tag_code",
        ).execute()
        written += 1
    return written


def record_manager_quality_events(
    client: Client,
    feedback: dict[str, Any],
    ai_row: dict[str, Any] | None,
) -> int:
    session = _select_one(client, "sessions", feedback["session_id"], "id,session_date,caterer_id")
    caterer_id = feedback.get("caterer_id") or session["caterer_id"]
    delivery = feedback.get("delivery_status") or "unknown"
    rating = feedback.get("food_quality_rating")
    leftovers = feedback.get("leftover_level") or "unknown"
    issue_tags = set(feedback.get("issue_tags") or [])
    severity = None
    event_type = "other"
    if delivery in SERIOUS_DELIVERY_STATUSES:
        severity = "serious"
        event_type = "missing_items" if delivery == "missing_items" else "manager_complaint"
    elif delivery in REVIEW_DELIVERY_STATUSES:
        severity = "review"
        event_type = "late_delivery_pattern"
    elif rating is not None and int(rating) <= 2:
        severity = "review"
        event_type = "food_quality"
    elif leftovers == "high":
        severity = "review"
        event_type = "food_quality"
    elif (
        delivery == "on_time"
        and (rating is None or int(rating) >= 4)
        and leftovers in {"none", "low"}
    ):
        severity = "info"
        event_type = "positive_feedback"
    elif issue_tags:
        severity = "review"
        event_type = "manager_complaint"
    if severity is None:
        return 0
    summary = _quality_summary("Manager feedback", feedback, ai_row)
    event = _insert_quality_event_once(
        client,
        event_key=f"manager-feedback:{feedback['id']}:{event_type}",
        caterer_id=caterer_id,
        session_id=feedback["session_id"],
        event_type=event_type,
        severity=severity,
        summary=summary,
        source="manager_feedback",
        source_session_catering_feedback_id=feedback["id"],
        metadata={"delivery_status": delivery, "rating": rating, "leftover_level": leftovers},
    )
    if severity == "serious":
        _create_quality_exception_once(client, session, caterer_id, event, summary)
    return 1 if event else 0


def record_student_quality_patterns(
    client: Client,
    feedback: dict[str, Any],
    ai_row: dict[str, Any] | None,
) -> int:
    session = _select_one(client, "sessions", feedback["session_id"], "id,session_date,caterer_id")
    week_start = date.fromisoformat(str(session["session_date"])) - timedelta(
        days=date.fromisoformat(str(session["session_date"])).weekday()
    )
    week_end = week_start + timedelta(days=6)
    sessions = (
        client.table("sessions")
        .select("id")
        .eq("caterer_id", session["caterer_id"])
        .gte("session_date", week_start.isoformat())
        .lte("session_date", week_end.isoformat())
        .execute()
        .data
    )
    session_ids = {row["id"] for row in sessions}
    if not session_ids or not feedback.get("dish_variant_id"):
        return 0
    rows = (
        client.table("student_meal_feedback")
        .select("id,rating")
        .in_("session_id", sorted(session_ids))
        .eq("dish_variant_id", feedback["dish_variant_id"])
        .execute()
        .data
    )
    total = len([row for row in rows if row.get("rating") is not None])
    if total < 3:
        return 0
    low = len([row for row in rows if row.get("rating") is not None and int(row["rating"]) <= 2])
    severity = (
        "serious" if total >= 5 and low / total >= 0.5 else "review" if low / total >= 0.3 else None
    )
    if severity is None:
        return 0
    summary = f"{low} of {total} student ratings were 1-2 for the same caterer/dish this week."
    event = _insert_quality_event_once(
        client,
        event_key=f"student-pattern:{session['caterer_id']}:{feedback['dish_variant_id']}:{week_start.isoformat()}",
        caterer_id=session["caterer_id"],
        session_id=feedback["session_id"],
        event_type="student_dislike",
        severity=severity,
        summary=summary,
        source="student_feedback",
        source_student_meal_feedback_id=feedback["id"],
        metadata={
            "low_rating_count": low,
            "feedback_count": total,
            "week_start": week_start.isoformat(),
        },
    )
    if severity == "serious" and event:
        _create_quality_exception_once(client, session, session["caterer_id"], event, summary)
    return 1 if event else 0


def _quality_summary(prefix: str, feedback: dict[str, Any], ai_row: dict[str, Any] | None) -> str:
    parsed = (ai_row or {}).get("parsed_output") or {}
    if parsed.get("summary"):
        return str(parsed["summary"])
    return (
        f"{prefix}: delivery={feedback.get('delivery_status')}; "
        f"rating={feedback.get('food_quality_rating')}; leftover={feedback.get('leftover_level')}."
    )


def _insert_quality_event_once(client: Client, **payload: Any) -> dict[str, Any] | None:
    try:
        existing = _select(client, "caterer_quality_events", "*", event_key=payload["event_key"])
        if existing:
            return None
        return client.table("caterer_quality_events").insert(payload).execute().data[0]
    except APIError:
        return None


def _create_quality_exception_once(
    client: Client,
    session: dict[str, Any],
    caterer_id: str,
    event: dict[str, Any],
    summary: str,
) -> None:
    session_date = date.fromisoformat(str(session["session_date"]))
    week_start = session_date - timedelta(days=session_date.weekday())
    metadata = {"quality_event_id": event["id"], "event_key": event.get("event_key")}
    existing = (
        client.table("autopilot_exceptions")
        .select("id")
        .eq("category", "quality")
        .contains("metadata", {"event_key": event.get("event_key")})
        .execute()
        .data
    )
    if existing:
        return
    row = (
        client.table("autopilot_exceptions")
        .insert(
            {
                "autopilot_run_id": None,
                "service_week_start": week_start.isoformat(),
                "severity": "blocked",
                "category": "quality",
                "title": "Serious caterer quality event",
                "detail": summary,
                "recommended_action": (
                    "Review caterer quality before the next automated offer selection."
                ),
                "session_id": session["id"],
                "caterer_id": caterer_id,
                "metadata": metadata,
            }
        )
        .execute()
        .data[0]
    )
    _insert_audit(
        client,
        action="autopilot_exception_created",
        entity_type="autopilot_exception",
        entity_id=row["id"],
        reason="Serious feedback created a quality exception.",
        after_state=row,
    )


def reset_demo_feedback_scenario(client: Client, *, actor_name: str) -> dict[str, Any]:
    """Ensure demo requests exist without deleting real form submissions."""
    result = ensure_feedback_requests(client)
    _insert_audit(
        client,
        action="feedback_demo_reset",
        entity_type="feedback_demo",
        entity_id="00000000-0000-0000-0000-000000000000",
        reason="Operator refreshed the feedback demo scenario.",
        after_state=result,
        actor_name=actor_name,
    )
    return result
