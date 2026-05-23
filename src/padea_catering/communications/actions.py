"""Deterministic communication snapshots and export tracking."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from supabase import Client

COMMUNICATION_TEMPLATE_VERSION = "caterer-order-v1"


def _require_text(value: str | None, field_name: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError(f"{field_name} is required.")
    return cleaned


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _select(client: Client, table: str, columns: str = "*", **eq) -> list[dict[str, Any]]:
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


def _format_money(cents: int) -> str:
    return f"${cents / 100:.2f}"


def _variant_display_name(dish_name: str, variant_name: str) -> str:
    return dish_name if variant_name == "Standard" else f"{dish_name} - {variant_name}"


def build_caterer_communication_draft(
    caterer: dict[str, Any],
    contacts: list[dict[str, Any]],
    sessions: list[dict[str, Any]],
    order_lines: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a deterministic caterer order draft without mutating state."""
    recipients = [
        {
            "caterer_contact_id": contact.get("id"),
            "display_name": contact.get("display_name"),
            "email": str(contact["email"]),
            "recipient_type": "to",
            "role": contact.get("role"),
            "cc_preference": contact.get("cc_preference"),
        }
        for contact in contacts
        if contact.get("email")
    ]
    recipient_emails = [recipient["email"] for recipient in recipients]
    subject = f"Padea catering order - {caterer['name']}"
    subtotal_cents = sum(row["line_total_cents"] for row in order_lines)
    total_meals = sum(row["quantity"] for row in order_lines)

    body_lines = [
        f"Hi {caterer['name']},",
        "",
        "Please prepare the following Padea tutoring meals:",
        "",
    ]
    delivery_lines = ["Delivery notes:"]

    lines_by_session: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for line in order_lines:
        lines_by_session[line["session_id"]].append(line)

    for session in sessions:
        destination = session.get("building") or "delivery location TBC"
        if session.get("room"):
            destination = f"{destination}, Room {session['room']}"
        session_heading = (
            f"{session['school_name']} - {session['session_date']} "
            f"dinner {session.get('dinner_time') or 'TBC'}"
        )
        manager_contact = (
            f"{session.get('manager_name') or 'TBC'} {session.get('manager_mobile') or ''}".strip()
        )
        body_lines.extend(
            [
                session_heading,
                f"Delivery: {destination}",
                f"Manager contact: {manager_contact}",
            ]
        )
        delivery_lines.extend(
            [
                session_heading,
                f"Delivery: {destination}",
                f"Manager contact: {manager_contact}",
            ]
        )
        for order_line in lines_by_session.get(session["session_id"], []):
            body_lines.append(f"- {order_line['quantity']} x {order_line['variant_name']}")
        body_lines.append("")
        delivery_lines.append("")

    body_lines.extend(
        [
            f"Total meals: {total_meals}",
            f"Item subtotal: {_format_money(subtotal_cents)}",
        ]
    )
    if caterer.get("delivery_fee_cents"):
        body_lines.append(
            f"Delivery fee noted in system: {_format_money(caterer['delivery_fee_cents'])} "
            f"({caterer.get('delivery_scope') or 'scope unknown'})"
        )
    body_lines.extend(["", "Thanks,", "Padea"])
    body = "\n".join(body_lines)
    rendered_text = "\n".join(
        [
            f"To: {', '.join(recipient_emails) if recipient_emails else '[confirm caterer email]'}",
            f"Subject: {subject}",
            "",
            body,
        ]
    )
    return {
        "subject": subject,
        "body": body,
        "recipients": recipients,
        "rendered_text": rendered_text,
        "delivery_note_text": "\n".join(delivery_lines).rstrip(),
        "template_version": COMMUNICATION_TEMPLATE_VERSION,
    }


def build_caterer_email_draft(
    caterer: dict[str, Any],
    contacts: list[dict[str, Any]],
    sessions: list[dict[str, Any]],
    order_lines: list[dict[str, Any]],
) -> str:
    """Compatibility wrapper returning the rendered draft text."""
    return build_caterer_communication_draft(
        caterer=caterer,
        contacts=contacts,
        sessions=sessions,
        order_lines=order_lines,
    )["rendered_text"]


def record_communication_export(
    client: Client,
    *,
    order_run_id: str,
    caterer_id: str,
    actor_name: str,
    reason: str,
) -> dict[str, Any]:
    """Persist or reuse a caterer communication snapshot and append an export event."""
    actor_name = _require_text(actor_name, "actor_name")
    reason = _require_text(reason, "reason")
    run = _select_one(client, "order_runs", order_run_id)
    if run["status"] != "approved":
        raise ValueError("Only approved order runs can be exported.")
    if run.get("issue_count", 0) != 0:
        raise ValueError("Approved order runs with allocation issues cannot be exported.")

    existing = _select(
        client,
        "order_communications",
        "*",
        order_run_id=order_run_id,
        caterer_id=caterer_id,
    )
    if existing:
        communication = existing[0]
        created = False
    else:
        draft = _build_export_draft(client, order_run_id, caterer_id)
        if not draft["recipients"]:
            raise ValueError("At least one recipient email is required before export.")
        now = _utc_now_iso()
        communication = (
            client.table("order_communications")
            .insert(
                {
                    "order_run_id": order_run_id,
                    "caterer_id": caterer_id,
                    "status": "exported",
                    "subject": draft["subject"],
                    "body": draft["body"],
                    "rendered_text": draft["rendered_text"],
                    "delivery_note_text": draft["delivery_note_text"],
                    "template_version": draft["template_version"],
                    "created_by": actor_name,
                    "created_at": now,
                    "exported_by": actor_name,
                    "exported_at": now,
                }
            )
            .execute()
            .data[0]
        )
        for recipient in draft["recipients"]:
            client.table("order_communication_recipients").insert(
                {
                    "communication_id": communication["id"],
                    **recipient,
                }
            ).execute()
        created = True

    event = (
        client.table("order_communication_events")
        .insert(
            {
                "communication_id": communication["id"],
                "event_type": "exported",
                "actor_name": actor_name,
                "reason": reason,
                "metadata": {
                    "order_run_id": order_run_id,
                    "caterer_id": caterer_id,
                    "snapshot_created": created,
                },
            }
        )
        .execute()
        .data[0]
    )
    _insert_audit_log(
        client,
        order_run_id=order_run_id,
        actor_name=actor_name,
        action="communication_exported",
        entity_type="order_communication",
        entity_id=communication["id"],
        reason=reason,
        before_state={},
        after_state={
            "communication_id": communication["id"],
            "event_id": event["id"],
            "caterer_id": caterer_id,
            "snapshot_created": created,
        },
    )
    return {"communication": communication, "event": event, "snapshot_created": created}


def _build_export_draft(client: Client, order_run_id: str, caterer_id: str) -> dict[str, Any]:
    caterer = _select_one(client, "caterers", caterer_id)
    sessions = {
        row["id"]: row
        for row in _select(
            client,
            "sessions",
            "id, caterer_id, school_id, session_date, dinner_time, building, room, "
            "manager_name, manager_mobile",
        )
    }
    schools = {row["id"]: row for row in _select(client, "schools", "id, canonical_name")}
    dishes = {row["id"]: row for row in _select(client, "dishes", "id, name")}
    variants = {row["id"]: row for row in _select(client, "dish_variants", "id, dish_id, name")}

    order_lines: list[dict[str, Any]] = []
    session_map: dict[str, dict[str, Any]] = {}
    for row in _select(client, "order_lines", "*", order_run_id=order_run_id):
        session = sessions[row["session_id"]]
        if session["caterer_id"] != caterer_id:
            continue
        school = schools[session["school_id"]]
        variant = variants[row["dish_variant_id"]]
        dish = dishes[row["dish_id"]]
        order_lines.append(
            {
                **row,
                "variant_name": _variant_display_name(dish["name"], variant["name"]),
            }
        )
        session_map.setdefault(
            row["session_id"],
            {
                "session_id": row["session_id"],
                "school_name": school["canonical_name"],
                "session_date": session["session_date"],
                "dinner_time": session.get("dinner_time"),
                "building": session.get("building"),
                "room": session.get("room"),
                "manager_name": session.get("manager_name"),
                "manager_mobile": session.get("manager_mobile"),
            },
        )
    if not order_lines:
        raise ValueError("Caterer has no order lines for this order run.")

    contacts = _select(
        client,
        "caterer_contacts",
        "id, caterer_id, role, display_name, email, cc_preference",
        caterer_id=caterer_id,
    )
    return build_caterer_communication_draft(
        caterer=caterer,
        contacts=contacts,
        sessions=sorted(
            session_map.values(), key=lambda row: (row["session_date"], row["school_name"])
        ),
        order_lines=sorted(order_lines, key=lambda row: (row["session_id"], row["variant_name"])),
    )
