"""Internal HTTP bridge for Python-owned catering operations."""

from __future__ import annotations

import os
import threading
from contextlib import asynccontextmanager
from datetime import date
from hmac import compare_digest
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from padea_catering.automation import (
    enqueue_autopilot_job,
    enqueue_feedback_dispatch_job,
    enqueue_reply_poll_job,
)
from padea_catering.automation.worker import run_forever as run_automation_worker
from padea_catering.autopilot import run_week_autopilot
from padea_catering.communications import record_communication_export, send_caterer_emails
from padea_catering.db import get_client
from padea_catering.exception_resolutions import (
    apply_resolution_preview,
    dismiss_caterer_reply_exception,
    edit_resolution_preview,
    generate_resolution_preview,
)
from padea_catering.feedback import (
    feedback_link_for_request,
    get_feedback_request_context,
    reset_demo_feedback_scenario,
    submit_manager_feedback,
    submit_student_feedback,
)
from padea_catering.ordering import generate_order_run
from padea_catering.replies import poll_gmail_caterer_replies, record_and_handle_caterer_reply

load_dotenv()


def _embedded_worker_enabled() -> bool:
    value = os.environ.get("PADEA_EMBEDDED_AUTOMATION_WORKER", "true").strip().lower()
    return value not in {"0", "false", "no", "off"}


@asynccontextmanager
async def backend_lifespan(_: FastAPI):
    """Run durable automation in-process unless deployment config disables it."""
    if not _embedded_worker_enabled():
        yield
        return

    stop_event = threading.Event()
    identity = os.environ.get("PADEA_AUTOMATION_WORKER_ID", "").strip() or f"embedded:{os.getpid()}"
    thread = threading.Thread(
        target=run_automation_worker,
        kwargs={"stop_event": stop_event, "identity": identity},
        name="padea-automation-worker",
        daemon=True,
    )
    thread.start()
    try:
        yield
    finally:
        stop_event.set()
        thread.join(timeout=5)


class CatererEmailSnapshotRequest(BaseModel):
    """Request body for creating or reusing a caterer email snapshot."""

    order_run_id: str = Field(alias="orderRunId", min_length=1)
    caterer_id: str = Field(alias="catererId", min_length=1)
    actor_name: str = Field(alias="actorName", min_length=1)
    reason: str | None = None


class CatererEmailSnapshotResponse(BaseModel):
    """Public response shape for the internal bridge endpoint."""

    communication_id: str = Field(alias="communicationId")
    event_id: str = Field(alias="eventId")
    snapshot_created: bool = Field(alias="snapshotCreated")


class CatererEmailSendRequest(BaseModel):
    """Request body for sending existing caterer email snapshots."""

    order_run_id: str = Field(alias="orderRunId", min_length=1)
    communication_ids: list[str] = Field(alias="communicationIds", min_length=1)
    actor_name: str = Field(alias="actorName", min_length=1)
    reason: str = Field(min_length=1)


class CatererEmailSendItem(BaseModel):
    """One communication send attempt result."""

    communication_id: str = Field(alias="communicationId")
    event_id: str = Field(alias="eventId")
    status: str
    caterer_id: str = Field(alias="catererId")
    metadata: dict[str, Any]


class CatererEmailSendResponse(BaseModel):
    """Public response shape for live caterer email sending."""

    sent: list[CatererEmailSendItem]
    failed: list[CatererEmailSendItem]


def _send_item(item: dict[str, Any]) -> CatererEmailSendItem:
    return CatererEmailSendItem(
        communicationId=item["communication_id"],
        eventId=item["event_id"],
        status=item["status"],
        catererId=item["caterer_id"],
        metadata=item["metadata"],
    )


class OrderRunRequest(BaseModel):
    """Request body for website-triggered order generation."""

    week_start: date = Field(alias="weekStart")
    actor_name: str = Field(alias="actorName", min_length=1)
    reason: str | None = None


class OrderRunResponse(BaseModel):
    """Public response shape for generated order runs."""

    order_run_id: str = Field(alias="orderRunId")
    status: str
    allocations: int
    order_lines: int = Field(alias="orderLines")
    issues: int


class AutopilotRunRequest(BaseModel):
    """Request body for starting or resuming one autopilot run."""

    week_start: date = Field(alias="weekStart")
    trigger_source: Literal["scheduled", "manual_demo", "retry"] = Field(alias="triggerSource")
    actor_name: str = Field(alias="actorName", min_length=1)
    idempotency_key: str | None = Field(default=None, alias="idempotencyKey")


class AutopilotRunResponse(BaseModel):
    """Public response shape for the internal autopilot bridge."""

    autopilot_run_id: str = Field(alias="autopilotRunId")
    status: str
    order_run_id: str | None = Field(alias="orderRunId")
    exception_count: int = Field(alias="exceptionCount")
    emails_prepared_count: int = Field(alias="emailsPreparedCount")
    emails_sent_count: int = Field(alias="emailsSentCount")
    summary: str


class AutomationJobResponse(BaseModel):
    """Response returned after durable work is queued or reused."""

    job_id: str = Field(alias="jobId")
    status: str
    reused: bool


class CatererReplyRequest(BaseModel):
    """Request body for paste-in/stored caterer reply intake."""

    order_run_id: str = Field(alias="orderRunId", min_length=1)
    caterer_id: str = Field(alias="catererId", min_length=1)
    raw_body: str = Field(alias="rawBody", min_length=1)
    communication_id: str | None = Field(default=None, alias="communicationId")
    subject: str | None = None
    from_email: str | None = Field(default=None, alias="fromEmail")
    received_at: str | None = Field(default=None, alias="receivedAt")
    provider_thread_id: str | None = Field(default=None, alias="providerThreadId")
    provider_message_id: str | None = Field(default=None, alias="providerMessageId")
    idempotency_key: str | None = Field(default=None, alias="idempotencyKey")
    actor_name: str | None = Field(default=None, alias="actorName")


class CatererReplyResponse(BaseModel):
    """Public response shape for caterer reply intake."""

    reply_id: str = Field(alias="replyId")
    ai_interpretation_id: str | None = Field(alias="aiInterpretationId")
    parsed_intent: str | None = Field(alias="parsedIntent")
    handled_status: str | None = Field(alias="handledStatus")
    exception_id: str | None = Field(alias="exceptionId")
    summary: str


class CatererReplyPollRequest(BaseModel):
    """Request body for backend-owned Gmail reply polling."""

    actor_name: str | None = Field(default=None, alias="actorName")


class AutomationAutopilotRequest(AutopilotRunRequest):
    actor_id: str | None = Field(default=None, alias="actorId")


class AutomationReplyPollRequest(CatererReplyPollRequest):
    actor_id: str | None = Field(default=None, alias="actorId")


class AutomationFeedbackDispatchRequest(BaseModel):
    actor_id: str | None = Field(default=None, alias="actorId")
    actor_name: str | None = Field(default=None, alias="actorName")


class CatererReplyPollResponse(BaseModel):
    """Public response shape for reply polling."""

    attempt_count: int = Field(alias="attemptCount")
    scanned_count: int = Field(alias="scannedCount")
    matched_count: int = Field(alias="matchedCount")
    already_seen_count: int = Field(alias="alreadySeenCount")
    ignored_count: int = Field(alias="ignoredCount")
    processed_count: int = Field(alias="processedCount")
    auto_handled_count: int = Field(alias="autoHandledCount")
    auto_adjusted_count: int = Field(alias="autoAdjustedCount")
    escalated_count: int = Field(alias="escalatedCount")
    failed_count: int = Field(alias="failedCount")
    reply_ids: list[str] = Field(alias="replyIds")
    order_run_ids: list[str] = Field(alias="orderRunIds")
    failed: list[dict[str, Any]]


class ResolutionPreviewRequest(BaseModel):
    exception_id: str = Field(alias="exceptionId", min_length=1)
    operator_instruction: str = Field(alias="operatorInstruction", min_length=1)
    actor_id: str = Field(alias="actorId", min_length=1)
    actor_name: str = Field(alias="actorName", min_length=1)
    idempotency_key: str = Field(alias="idempotencyKey", min_length=1)


class ResolutionEditRequest(BaseModel):
    action: dict[str, Any]
    message_text: str = Field(alias="messageText", min_length=1)
    actor_id: str = Field(alias="actorId", min_length=1)


class ResolutionApplyRequest(BaseModel):
    actor_id: str = Field(alias="actorId", min_length=1)
    actor_name: str = Field(alias="actorName", min_length=1)


class ExceptionDismissRequest(BaseModel):
    note: str = Field(min_length=1)
    actor_id: str = Field(alias="actorId", min_length=1)
    actor_name: str = Field(alias="actorName", min_length=1)


class ResolutionResponse(BaseModel):
    resolution_id: str = Field(alias="resolutionId")
    status: str
    validation_report: dict[str, Any] = Field(alias="validationReport")
    resulting_order_run_id: str | None = Field(alias="resultingOrderRunId")
    resulting_communication_id: str | None = Field(alias="resultingCommunicationId")
    failure_detail: str | None = Field(alias="failureDetail")


class FeedbackContextResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    audience: str
    status: str
    school_name: str = Field(alias="schoolName")
    session_date: str = Field(alias="sessionDate")
    session_date_label: str = Field(alias="sessionDateLabel")
    caterer_name: str = Field(alias="catererName")
    student_name: str | None = Field(alias="studentName")
    dish_name: str | None = Field(alias="dishName")
    manager_name: str | None = Field(alias="managerName")
    expires_at: str = Field(alias="expiresAt")
    submitted_at: str | None = Field(alias="submittedAt")


class StudentFeedbackSubmitRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    free_text: str | None = Field(default=None, alias="freeText", max_length=4000)
    requested_food: str | None = Field(default=None, alias="requestedFood", max_length=1000)


class ManagerFeedbackSubmitRequest(BaseModel):
    everything_ok: bool = Field(alias="everythingOk")
    delivery_status: str | None = Field(default=None, alias="deliveryStatus")
    food_quality_rating: int | None = Field(default=None, alias="foodQualityRating", ge=1, le=5)
    leftover_level: str | None = Field(default=None, alias="leftoverLevel")
    issue_tags: list[str] = Field(default_factory=list, alias="issueTags")
    manager_notes: str | None = Field(default=None, alias="managerNotes", max_length=4000)


class FeedbackSubmitResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    feedback_id: str = Field(alias="feedbackId")
    status: str


class FeedbackLinkResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    url: str


class FeedbackDemoResetRequest(BaseModel):
    actor_name: str = Field(alias="actorName", min_length=1)


def _resolution_response(row: dict[str, Any]) -> ResolutionResponse:
    return ResolutionResponse(
        resolutionId=row["id"],
        status=row["status"],
        validationReport=row.get("validation_report") or {},
        resultingOrderRunId=row.get("resulting_order_run_id"),
        resultingCommunicationId=row.get("resulting_communication_id"),
        failureDetail=row.get("failure_detail"),
    )


app = FastAPI(title="Padea Catering Internal Backend", lifespan=backend_lifespan)


def require_backend_secret(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("PADEA_BACKEND_SHARED_SECRET")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backend shared secret is not configured.",
        )

    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing backend bearer token.",
        )

    if not compare_digest(token, expected):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid backend bearer token.",
        )


@app.post(
    "/internal/caterer-email-snapshots",
    response_model=CatererEmailSnapshotResponse,
    dependencies=[Depends(require_backend_secret)],
)
def create_caterer_email_snapshot(
    request: CatererEmailSnapshotRequest,
) -> CatererEmailSnapshotResponse:
    """Create the first caterer email snapshot or record a repeated export event."""
    client = get_client()

    try:
        reason = (request.reason or "").strip() or "Created caterer email snapshot from website."
        result = record_communication_export(
            client,
            order_run_id=request.order_run_id,
            caterer_id=request.caterer_id,
            actor_name=request.actor_name,
            reason=reason,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return CatererEmailSnapshotResponse(
        communicationId=result["communication"]["id"],
        eventId=result["event"]["id"],
        snapshotCreated=result["snapshot_created"],
    )


@app.post(
    "/internal/caterer-email-sends",
    response_model=CatererEmailSendResponse,
    dependencies=[Depends(require_backend_secret)],
)
def send_caterer_email_snapshots(
    request: CatererEmailSendRequest,
) -> CatererEmailSendResponse:
    """Send reviewed caterer email snapshots through the configured provider."""
    client = get_client()

    try:
        result = send_caterer_emails(
            client,
            order_run_id=request.order_run_id,
            communication_ids=request.communication_ids,
            actor_name=request.actor_name,
            reason=request.reason,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return CatererEmailSendResponse(
        sent=[_send_item(item) for item in result["sent"]],
        failed=[_send_item(item) for item in result["failed"]],
    )


def _supersedable_order_runs(client: Any, week_start: date) -> list[dict[str, Any]]:
    rows = (
        client.table("order_runs")
        .select("id,status")
        .eq("service_week_start", week_start.isoformat())
        .execute()
        .data
    )
    return [
        {"id": row.get("id"), "status": row.get("status")}
        for row in rows
        if row.get("status") in {"blocked", "generated"}
    ]


def _insert_order_run_generated_audit(
    client: Any,
    *,
    actor_name: str,
    reason: str,
    week_start: date,
    result: dict[str, Any],
    superseded_runs: list[dict[str, Any]],
) -> None:
    order_run_id = result["order_run_id"]
    client.table("audit_log").insert(
        {
            "order_run_id": order_run_id,
            "actor_name": actor_name,
            "action": "order_run_generated",
            "entity_type": "order_run",
            "entity_id": order_run_id,
            "reason": reason,
            "before_state": {
                "week_start": week_start.isoformat(),
                "superseded_order_runs": superseded_runs,
            },
            "after_state": {
                "week_start": week_start.isoformat(),
                "order_run_id": order_run_id,
                "status": result["status"],
                "allocations": result["allocations"],
                "order_lines": result["order_lines"],
                "issues": result["issues"],
            },
        }
    ).execute()


@app.post(
    "/internal/order-runs",
    response_model=OrderRunResponse,
    dependencies=[Depends(require_backend_secret)],
)
def create_order_run(request: OrderRunRequest) -> OrderRunResponse:
    """Generate and persist a website-requested order run through Python logic."""
    client = get_client()
    actor_name = request.actor_name.strip()
    reason = (request.reason or "").strip() or "Generated order run from website."

    try:
        superseded_runs = _supersedable_order_runs(client, request.week_start)
        result = generate_order_run(
            client,
            request.week_start,
            generated_by=actor_name,
        )
        _insert_order_run_generated_audit(
            client,
            actor_name=actor_name,
            reason=reason,
            week_start=request.week_start,
            result=result,
            superseded_runs=superseded_runs,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return OrderRunResponse(
        orderRunId=result["order_run_id"],
        status=result["status"],
        allocations=result["allocations"],
        orderLines=result["order_lines"],
        issues=result["issues"],
    )


@app.post(
    "/internal/autopilot-runs",
    response_model=AutopilotRunResponse,
    dependencies=[Depends(require_backend_secret)],
)
def create_autopilot_run(request: AutopilotRunRequest) -> AutopilotRunResponse:
    """Start or resume a Python-owned autopilot run."""
    client = get_client()

    try:
        result = run_week_autopilot(
            client,
            request.week_start,
            trigger_source=request.trigger_source,
            idempotency_key=request.idempotency_key,
            requested_by=request.actor_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return AutopilotRunResponse(
        autopilotRunId=result["autopilot_run_id"],
        status=result["status"],
        orderRunId=result["order_run_id"],
        exceptionCount=result["exception_count"],
        emailsPreparedCount=result["emails_prepared_count"],
        emailsSentCount=result["emails_sent_count"],
        summary=result["summary"],
    )


@app.post(
    "/internal/automation-jobs/autopilot",
    response_model=AutomationJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_backend_secret)],
)
def enqueue_autopilot_run(request: AutomationAutopilotRequest) -> AutomationJobResponse:
    """Queue a durable autopilot run and return immediately."""
    client = get_client()
    try:
        job, reused = enqueue_autopilot_job(
            client,
            week_start=request.week_start.isoformat(),
            trigger_source=(
                "manual" if request.trigger_source == "manual_demo" else request.trigger_source
            ),
            idempotency_key=request.idempotency_key
            or f"autopilot:{request.week_start.isoformat()}:{request.trigger_source}",
            actor_id=request.actor_id,
            actor_name=request.actor_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AutomationJobResponse(jobId=job["id"], status=job["status"], reused=reused)


@app.post(
    "/internal/caterer-replies",
    response_model=CatererReplyResponse,
    dependencies=[Depends(require_backend_secret)],
)
def create_caterer_reply(request: CatererReplyRequest) -> CatererReplyResponse:
    """Record and handle a caterer reply through Python-owned policy."""
    client = get_client()

    try:
        result = record_and_handle_caterer_reply(
            client,
            order_run_id=request.order_run_id,
            caterer_id=request.caterer_id,
            raw_body=request.raw_body,
            communication_id=request.communication_id,
            subject=request.subject,
            from_email=request.from_email,
            received_at=request.received_at,
            provider_thread_id=request.provider_thread_id,
            provider_message_id=request.provider_message_id,
            idempotency_key=request.idempotency_key,
            actor_name=request.actor_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return CatererReplyResponse(
        replyId=result["reply_id"],
        aiInterpretationId=result["ai_interpretation_id"],
        parsedIntent=result["parsed_intent"],
        handledStatus=result["handled_status"],
        exceptionId=result["exception_id"],
        summary=result["summary"],
    )


@app.post(
    "/internal/caterer-reply-poll",
    response_model=CatererReplyPollResponse,
    dependencies=[Depends(require_backend_secret)],
)
def poll_caterer_replies(request: CatererReplyPollRequest) -> CatererReplyPollResponse:
    """Poll Gmail IMAP for caterer replies and handle linked replies."""
    client = get_client()

    try:
        result = poll_gmail_caterer_replies(
            client,
            actor_name=request.actor_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return CatererReplyPollResponse(
        attemptCount=result["attempt_count"],
        scannedCount=result["scanned_count"],
        matchedCount=result["matched_count"],
        alreadySeenCount=result["already_seen_count"],
        ignoredCount=result["ignored_count"],
        processedCount=result["processed_count"],
        autoHandledCount=result["auto_handled_count"],
        autoAdjustedCount=result["auto_adjusted_count"],
        escalatedCount=result["escalated_count"],
        failedCount=result["failed_count"],
        replyIds=result["reply_ids"],
        orderRunIds=result["order_run_ids"],
        failed=result["failed"],
    )


@app.post(
    "/internal/automation-jobs/caterer-reply-poll",
    response_model=AutomationJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_backend_secret)],
)
def enqueue_caterer_reply_poll(
    request: AutomationReplyPollRequest,
) -> AutomationJobResponse:
    """Queue an immediate reply check or reuse the active check."""
    client = get_client()
    try:
        job, reused = enqueue_reply_poll_job(
            client,
            trigger_source="manual",
            actor_id=request.actor_id,
            actor_name=(request.actor_name or "").strip() or "Autopilot",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AutomationJobResponse(jobId=job["id"], status=job["status"], reused=reused)


@app.post(
    "/internal/automation-jobs/feedback-dispatch",
    response_model=AutomationJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_backend_secret)],
)
def enqueue_feedback_dispatch(
    request: AutomationFeedbackDispatchRequest,
) -> AutomationJobResponse:
    """Queue an immediate feedback invitation/request check."""
    client = get_client()
    try:
        job, reused = enqueue_feedback_dispatch_job(
            client,
            trigger_source="manual",
            actor_id=request.actor_id,
            actor_name=(request.actor_name or "").strip() or "Feedback Agent",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AutomationJobResponse(jobId=job["id"], status=job["status"], reused=reused)


def _feedback_context_response(context: dict[str, Any]) -> FeedbackContextResponse:
    return FeedbackContextResponse(
        requestId=context["requestId"],
        audience=context["audience"],
        status=context["status"],
        schoolName=context["schoolName"],
        sessionDate=context["sessionDate"],
        sessionDateLabel=context["sessionDateLabel"],
        catererName=context["catererName"],
        studentName=context.get("studentName"),
        dishName=context.get("dishName"),
        managerName=context.get("managerName"),
        expiresAt=context["expiresAt"],
        submittedAt=context.get("submittedAt"),
    )


@app.get(
    "/internal/feedback/student/{token}",
    response_model=FeedbackContextResponse,
    dependencies=[Depends(require_backend_secret)],
)
def get_student_feedback_context(token: str) -> FeedbackContextResponse:
    """Resolve a signed student feedback link for public form rendering."""
    try:
        return _feedback_context_response(
            get_feedback_request_context(get_client(), token, expected_audience="student")
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@app.get(
    "/internal/feedback/session/{token}",
    response_model=FeedbackContextResponse,
    dependencies=[Depends(require_backend_secret)],
)
def get_manager_feedback_context(token: str) -> FeedbackContextResponse:
    """Resolve a signed session-manager feedback link for public form rendering."""
    try:
        return _feedback_context_response(
            get_feedback_request_context(
                get_client(),
                token,
                expected_audience="session_manager",
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@app.post(
    "/internal/feedback/student/{token}",
    response_model=FeedbackSubmitResponse,
    dependencies=[Depends(require_backend_secret)],
)
def post_student_feedback(
    token: str,
    request: StudentFeedbackSubmitRequest,
) -> FeedbackSubmitResponse:
    """Persist student feedback and queue backend-owned interpretation."""
    try:
        result = submit_student_feedback(
            get_client(),
            token=token,
            rating=request.rating,
            free_text=request.free_text,
            requested_food=request.requested_food,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return FeedbackSubmitResponse(
        requestId=result["request"]["id"],
        feedbackId=result["feedback"]["id"],
        status=result["request"]["status"],
    )


@app.post(
    "/internal/feedback/session/{token}",
    response_model=FeedbackSubmitResponse,
    dependencies=[Depends(require_backend_secret)],
)
def post_manager_feedback(
    token: str,
    request: ManagerFeedbackSubmitRequest,
) -> FeedbackSubmitResponse:
    """Persist session-manager feedback and queue backend-owned processing."""
    try:
        result = submit_manager_feedback(
            get_client(),
            token=token,
            everything_ok=request.everything_ok,
            delivery_status=request.delivery_status,
            food_quality_rating=request.food_quality_rating,
            leftover_level=request.leftover_level,
            issue_tags=request.issue_tags,
            manager_notes=request.manager_notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return FeedbackSubmitResponse(
        requestId=result["request"]["id"],
        feedbackId=result["feedback"]["id"],
        status=result["request"]["status"],
    )


@app.get(
    "/internal/feedback-requests/{request_id}/link",
    response_model=FeedbackLinkResponse,
    dependencies=[Depends(require_backend_secret)],
)
def get_feedback_request_link(request_id: str) -> FeedbackLinkResponse:
    """Return an operator-visible signed feedback URL for copy/QR display."""
    client = get_client()
    try:
        row = (
            client.table("feedback_requests")
            .select("id,audience")
            .eq("id", request_id)
            .limit(1)
            .execute()
            .data
        )
        if not row:
            raise ValueError("Feedback request does not exist.")
        request = row[0]
        return FeedbackLinkResponse(
            requestId=request["id"],
            url=feedback_link_for_request(request["id"], request["audience"]),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@app.post(
    "/internal/feedback-demo/reset",
    dependencies=[Depends(require_backend_secret)],
)
def reset_feedback_demo(request: FeedbackDemoResetRequest) -> dict[str, Any]:
    """Refresh deterministic feedback-demo request rows."""
    try:
        return reset_demo_feedback_scenario(get_client(), actor_name=request.actor_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@app.post(
    "/internal/exception-resolution-previews",
    response_model=ResolutionResponse,
    dependencies=[Depends(require_backend_secret)],
)
def create_exception_resolution_preview(
    request: ResolutionPreviewRequest,
) -> ResolutionResponse:
    """Generate and persist a side-effect-free operator resolution preview."""
    try:
        row = generate_resolution_preview(
            get_client(),
            exception_id=request.exception_id,
            operator_instruction=request.operator_instruction,
            actor_id=request.actor_id,
            actor_name=request.actor_name,
            idempotency_key=request.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _resolution_response(row)


@app.put(
    "/internal/exception-resolution-previews/{resolution_id}",
    response_model=ResolutionResponse,
    dependencies=[Depends(require_backend_secret)],
)
def update_exception_resolution_preview(
    resolution_id: str,
    request: ResolutionEditRequest,
) -> ResolutionResponse:
    """Persist operator edits and revalidate the preview."""
    try:
        row = edit_resolution_preview(
            get_client(),
            resolution_id=resolution_id,
            action=request.action,
            message_text=request.message_text,
            actor_id=request.actor_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _resolution_response(row)


@app.post(
    "/internal/exception-resolution-previews/{resolution_id}/apply",
    response_model=ResolutionResponse,
    dependencies=[Depends(require_backend_secret)],
)
def apply_exception_resolution(
    resolution_id: str,
    request: ResolutionApplyRequest,
) -> ResolutionResponse:
    """Apply and send one ready, revalidated resolution preview."""
    try:
        row = apply_resolution_preview(
            get_client(),
            resolution_id=resolution_id,
            actor_id=request.actor_id,
            actor_name=request.actor_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _resolution_response(row)


@app.post(
    "/internal/autopilot-exceptions/{exception_id}/dismiss",
    dependencies=[Depends(require_backend_secret)],
)
def dismiss_exception(
    exception_id: str,
    request: ExceptionDismissRequest,
) -> dict[str, str]:
    """Dismiss one open caterer reply exception with an operator note."""
    try:
        row = dismiss_caterer_reply_exception(
            get_client(),
            exception_id=exception_id,
            note=request.note,
            actor_id=request.actor_id,
            actor_name=request.actor_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"exceptionId": row["id"], "status": row["status"]}
