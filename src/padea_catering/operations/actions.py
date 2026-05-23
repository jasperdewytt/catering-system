"""Audited operational actions.

All status-changing operator actions live here, not in Streamlit.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

APPROVABLE_STATUS = "generated"
OVERRIDE_TYPES = {
    "allocation",
    "order_line",
    "student_attendance",
    "dietary_resolution",
    "contact",
    "other",
}


def _require_text(value: str | None, field_name: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError(f"{field_name} is required.")
    return cleaned


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _select_one(client: Client, table: str, row_id: str) -> dict[str, Any]:
    rows = client.table(table).select("*").eq("id", row_id).execute().data
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
    before_state: dict[str, Any],
    after_state: dict[str, Any],
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
                "before_state": before_state,
                "after_state": after_state,
            }
        )
        .execute()
        .data[0]
    )


def approve_order_run(
    client: Client,
    order_run_id: str,
    actor_name: str,
    reason: str,
) -> dict[str, Any]:
    """Approve a generated order run and write an audit row."""
    actor_name = _require_text(actor_name, "actor_name")
    reason = _require_text(reason, "reason")
    before = _select_one(client, "order_runs", order_run_id)
    if before["status"] != APPROVABLE_STATUS:
        raise ValueError("Only generated order runs can be approved.")

    update_payload = {
        "status": "approved",
        "approved_at": _utc_now_iso(),
        "approved_by": actor_name,
        "approval_note": reason,
    }
    client.table("order_runs").update(update_payload).eq("id", order_run_id).execute()
    after = {**before, **update_payload}
    _insert_audit_log(
        client,
        order_run_id=order_run_id,
        actor_name=actor_name,
        action="order_run_approved",
        entity_type="order_run",
        entity_id=order_run_id,
        reason=reason,
        before_state=before,
        after_state=after,
    )
    return after


def unapprove_order_run(
    client: Client,
    order_run_id: str,
    actor_name: str,
    reason: str,
) -> dict[str, Any]:
    """Reopen an approved order run and write an audit row."""
    actor_name = _require_text(actor_name, "actor_name")
    reason = _require_text(reason, "reason")
    before = _select_one(client, "order_runs", order_run_id)
    if before["status"] != "approved":
        raise ValueError("Only approved order runs can be reopened.")

    update_payload = {
        "status": "generated",
        "approved_at": None,
        "approved_by": None,
        "approval_note": None,
    }
    client.table("order_runs").update(update_payload).eq("id", order_run_id).execute()
    after = {**before, **update_payload}
    _insert_audit_log(
        client,
        order_run_id=order_run_id,
        actor_name=actor_name,
        action="order_run_unapproved",
        entity_type="order_run",
        entity_id=order_run_id,
        reason=reason,
        before_state=before,
        after_state=after,
    )
    return after


def record_manual_override(
    client: Client,
    *,
    order_run_id: str,
    actor_name: str,
    override_type: str,
    entity_type: str,
    entity_id: str | None,
    reason: str,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Record a manual override without applying any domain mutation."""
    actor_name = _require_text(actor_name, "actor_name")
    reason = _require_text(reason, "reason")
    entity_type = _require_text(entity_type, "entity_type")
    if override_type not in OVERRIDE_TYPES:
        raise ValueError(f"override_type must be one of {sorted(OVERRIDE_TYPES)}.")
    _select_one(client, "order_runs", order_run_id)

    before_state = before_state or {}
    after_state = after_state or {}
    override_row = (
        client.table("manual_overrides")
        .insert(
            {
                "order_run_id": order_run_id,
                "actor_name": actor_name,
                "override_type": override_type,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "reason": reason,
                "before_state": before_state,
                "after_state": after_state,
            }
        )
        .execute()
        .data[0]
    )
    _insert_audit_log(
        client,
        order_run_id=order_run_id,
        actor_name=actor_name,
        action="manual_override_created",
        entity_type="manual_override",
        entity_id=override_row["id"],
        reason=reason,
        before_state=before_state,
        after_state={**after_state, "manual_override_id": override_row["id"]},
    )
    return override_row


def get_audit_history(client: Client, order_run_id: str) -> list[dict[str, Any]]:
    rows = client.table("audit_log").select("*").eq("order_run_id", order_run_id).execute().data
    return sorted(rows, key=lambda row: (row["created_at"], row["id"]), reverse=True)
