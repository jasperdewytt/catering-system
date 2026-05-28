"""Internal HTTP bridge for Python-owned catering operations."""

from __future__ import annotations

import os
from datetime import date
from hmac import compare_digest
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from padea_catering.communications import record_communication_export
from padea_catering.db import get_client
from padea_catering.ordering import generate_order_run

load_dotenv()


class CatererEmailSnapshotRequest(BaseModel):
    """Request body for creating or reusing a caterer email snapshot."""

    order_run_id: str = Field(alias="orderRunId", min_length=1)
    caterer_id: str = Field(alias="catererId", min_length=1)
    actor_name: str = Field(alias="actorName", min_length=1)
    reason: str = Field(min_length=1)


class CatererEmailSnapshotResponse(BaseModel):
    """Public response shape for the internal bridge endpoint."""

    communication_id: str = Field(alias="communicationId")
    event_id: str = Field(alias="eventId")
    snapshot_created: bool = Field(alias="snapshotCreated")


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


app = FastAPI(title="Padea Catering Internal Backend")


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
        result = record_communication_export(
            client,
            order_run_id=request.order_run_id,
            caterer_id=request.caterer_id,
            actor_name=request.actor_name,
            reason=request.reason,
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
