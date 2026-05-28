"""Deterministic communication snapshots and export tracking."""

from __future__ import annotations

import os
import smtplib
from collections import defaultdict
from datetime import UTC, datetime
from email.message import EmailMessage
from typing import Any

from supabase import Client

COMMUNICATION_TEMPLATE_VERSION = "caterer-order-v1"
READY_TO_SEND_STATUSES = {"exported", "failed"}


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


def _update_by_id(
    client: Client, table: str, row_id: str, payload: dict[str, Any]
) -> dict[str, Any]:
    rows = client.table(table).update(payload).eq("id", row_id).execute().data
    return rows[0] if rows else {}


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


class EmailDeliveryError(Exception):
    """Raised when the configured email provider rejects a send."""


class EmailProvider:
    """Small provider boundary for live caterer email sends."""

    provider_name = "unknown"

    def send(
        self,
        *,
        subject: str,
        body: str,
        to_emails: list[str],
    ) -> dict[str, Any]:
        raise NotImplementedError


class GmailSMTPEmailProvider(EmailProvider):
    """Gmail SMTP provider using TLS and an app password."""

    provider_name = "gmail_smtp"

    def __init__(
        self,
        *,
        from_email: str,
        username: str,
        app_password: str,
        test_recipient_override: str,
        host: str = "smtp.gmail.com",
        port: int = 587,
    ) -> None:
        self.from_email = _require_text(from_email, "PADEA_EMAIL_FROM")
        self.username = _require_text(username, "PADEA_GMAIL_SMTP_USERNAME")
        self.app_password = _require_text(
            app_password,
            "PADEA_GMAIL_SMTP_APP_PASSWORD",
        )
        self.test_recipient_override = _require_text(
            test_recipient_override,
            "PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE",
        )
        self.host = host
        self.port = port

    def send(
        self,
        *,
        subject: str,
        body: str,
        to_emails: list[str],
    ) -> dict[str, Any]:
        if not to_emails:
            raise EmailDeliveryError("At least one recipient email is required before sending.")

        message = EmailMessage()
        message["From"] = self.from_email
        message["To"] = self.test_recipient_override
        message["Subject"] = subject
        message["Reply-To"] = self.from_email
        message["X-Padea-Original-To"] = ", ".join(to_emails)
        message.set_content(body)

        try:
            with smtplib.SMTP(self.host, self.port, timeout=30) as smtp:
                smtp.starttls()
                smtp.login(self.username, self.app_password)
                response = smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise EmailDeliveryError(str(exc)) from exc

        return {
            "provider": self.provider_name,
            "host": self.host,
            "port": self.port,
            "from_email": self.from_email,
            "actual_recipients": [self.test_recipient_override],
            "requested_recipients": to_emails,
            "test_recipient_override": self.test_recipient_override,
            "smtp_response": response,
        }


def email_provider_from_env() -> EmailProvider:
    """Build the configured backend-only email provider."""
    provider = os.environ.get("PADEA_EMAIL_PROVIDER", "").strip()
    if provider != "gmail_smtp":
        raise ValueError("PADEA_EMAIL_PROVIDER must be set to gmail_smtp for v1 email sends.")

    return GmailSMTPEmailProvider(
        from_email=os.environ.get("PADEA_EMAIL_FROM", ""),
        username=os.environ.get("PADEA_GMAIL_SMTP_USERNAME", ""),
        app_password=os.environ.get("PADEA_GMAIL_SMTP_APP_PASSWORD", ""),
        test_recipient_override=os.environ.get("PADEA_EMAIL_TEST_RECIPIENT_OVERRIDE", ""),
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


def send_caterer_emails(
    client: Client,
    *,
    order_run_id: str,
    communication_ids: list[str],
    actor_name: str,
    reason: str,
    provider: EmailProvider | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Send existing communication snapshots and record per-send audit events."""
    actor_name = _require_text(actor_name, "actor_name")
    reason = _require_text(reason, "reason")
    if not communication_ids:
        raise ValueError("At least one communication id is required.")

    provider = provider or email_provider_from_env()
    run = _select_one(client, "order_runs", order_run_id)
    if run["status"] != "approved":
        raise ValueError("Only approved order runs can have caterer emails sent.")
    if run.get("issue_count", 0) != 0:
        raise ValueError("Approved order runs with allocation issues cannot have emails sent.")

    requested_ids = set(communication_ids)
    communications = _select(client, "order_communications", "*", order_run_id=order_run_id)
    by_id = {row["id"]: row for row in communications if row.get("id") in requested_ids}
    missing = [
        communication_id for communication_id in communication_ids if communication_id not in by_id
    ]
    if missing:
        raise ValueError("All requested communications must already have persisted snapshots.")

    for communication_id in communication_ids:
        status = by_id[communication_id].get("status")
        if status == "sent":
            raise ValueError("Already-sent caterer emails cannot be resent in v1.")
        if status not in READY_TO_SEND_STATUSES:
            raise ValueError("Only email-ready or failed communication snapshots can be sent.")

    recipient_emails_by_communication: dict[str, list[str]] = {}
    for communication_id in communication_ids:
        recipients = _select(
            client,
            "order_communication_recipients",
            "email, recipient_type",
            communication_id=communication_id,
        )
        recipient_emails_by_communication[communication_id] = [
            str(recipient["email"])
            for recipient in recipients
            if recipient.get("email") and recipient.get("recipient_type") == "to"
        ]

    if any(not emails for emails in recipient_emails_by_communication.values()):
        raise ValueError("Every requested communication must have at least one to recipient.")

    sent: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []

    for communication_id in communication_ids:
        communication = by_id[communication_id]
        to_emails = recipient_emails_by_communication[communication_id]

        before_state = {
            "communication_id": communication_id,
            "status": communication.get("status"),
        }
        try:
            provider_metadata = provider.send(
                subject=communication["subject"],
                body=communication["body"],
                to_emails=to_emails,
            )
        except EmailDeliveryError as exc:
            updated = _record_send_attempt(
                client,
                communication=communication,
                actor_name=actor_name,
                reason=reason,
                event_type="send_failed",
                audit_action="communication_send_failed",
                status_value="failed",
                before_state=before_state,
                metadata={
                    "provider": provider.provider_name,
                    "requested_recipients": to_emails,
                    "error": str(exc),
                },
            )
            failed.append(updated)
            continue

        updated = _record_send_attempt(
            client,
            communication=communication,
            actor_name=actor_name,
            reason=reason,
            event_type="sent",
            audit_action="communication_sent",
            status_value="sent",
            before_state=before_state,
            metadata=provider_metadata,
        )
        sent.append(updated)

    return {"sent": sent, "failed": failed}


def _record_send_attempt(
    client: Client,
    *,
    communication: dict[str, Any],
    actor_name: str,
    reason: str,
    event_type: str,
    audit_action: str,
    status_value: str,
    before_state: dict[str, Any],
    metadata: dict[str, Any],
) -> dict[str, Any]:
    now = _utc_now_iso()
    communication_id = communication["id"]
    updated_communication = _update_by_id(
        client,
        "order_communications",
        communication_id,
        {"status": status_value},
    )
    event = (
        client.table("order_communication_events")
        .insert(
            {
                "communication_id": communication_id,
                "event_type": event_type,
                "actor_name": actor_name,
                "reason": reason,
                "metadata": metadata,
                "created_at": now,
            }
        )
        .execute()
        .data[0]
    )
    after_state = {
        "communication_id": communication_id,
        "event_id": event["id"],
        "caterer_id": communication["caterer_id"],
        "status": status_value,
        "provider": metadata.get("provider"),
        "metadata": metadata,
    }
    _insert_audit_log(
        client,
        order_run_id=communication["order_run_id"],
        actor_name=actor_name,
        action=audit_action,
        entity_type="order_communication",
        entity_id=communication_id,
        reason=reason,
        before_state=before_state,
        after_state=after_state,
    )
    return {
        "communication_id": communication_id,
        "event_id": event["id"],
        "status": updated_communication.get("status", status_value),
        "caterer_id": communication["caterer_id"],
        "metadata": metadata,
    }


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
