"""Read-only order review actions.

The review MVP displays generated order state and deterministic draft text.
It must not approve, mutate, or send anything.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from supabase import Client

FREE_WEBMAIL_DOMAINS = {"gmail.com", "outlook.com", "yahoo.com", "hotmail.com"}


def _select(client: Client, table: str, columns: str = "*", **eq) -> list[dict[str, Any]]:
    query = client.table(table).select(columns)
    for key, value in eq.items():
        query = query.eq(key, value)
    return query.execute().data


def format_money(cents: int) -> str:
    return f"${cents / 100:.2f}"


def variant_display_name(dish_name: str, variant_name: str) -> str:
    return dish_name if variant_name == "Standard" else f"{dish_name} - {variant_name}"


def status_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    return dict(Counter(row["status"] for row in rows))


def select_default_order_run_id(runs: list[dict[str, Any]]) -> str | None:
    generated = [row for row in runs if row["status"] == "generated"]
    candidates = generated or runs
    if not candidates:
        return None
    return sorted(
        candidates,
        key=lambda row: (
            row.get("generated_at") or "",
            row.get("created_at") or "",
            row["id"],
        ),
        reverse=True,
    )[0]["id"]


def _contact_warning(contact: dict[str, Any]) -> str | None:
    if not contact.get("is_verified"):
        return "unverified"
    email = str(contact.get("email") or "")
    domain = email.split("@")[-1].lower() if "@" in email else ""
    if domain in FREE_WEBMAIL_DOMAINS:
        return "free webmail"
    return None


def get_order_runs(client: Client) -> list[dict[str, Any]]:
    runs = _select(
        client,
        "order_runs",
        (
            "id, service_week_start, service_week_end, status, algorithm_version, "
            "generated_by, generated_at, issue_count, created_at"
        ),
    )
    return sorted(
        runs,
        key=lambda row: (row.get("generated_at") or "", row.get("created_at") or "", row["id"]),
        reverse=True,
    )


def get_order_review(client: Client, order_run_id: str) -> dict[str, Any]:
    runs = [row for row in get_order_runs(client) if row["id"] == order_run_id]
    if not runs:
        raise ValueError(f"Order run {order_run_id!r} does not exist.")
    run = runs[0]

    schools = {row["id"]: row for row in _select(client, "schools", "id, canonical_name")}
    caterers = {row["id"]: row for row in _select(client, "caterers")}
    sessions = {row["id"]: row for row in _select(client, "sessions")}
    dishes = {row["id"]: row for row in _select(client, "dishes", "id, name")}
    variants = {row["id"]: row for row in _select(client, "dish_variants", "id, dish_id, name")}
    students = {row["id"]: row for row in _select(client, "students", "id, full_name, year_level")}
    contacts_by_caterer: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for contact in _select(
        client,
        "caterer_contacts",
        "id, caterer_id, role, display_name, email, cc_preference, is_verified, role_note",
    ):
        contact["warning"] = _contact_warning(contact)
        contacts_by_caterer[contact["caterer_id"]].append(contact)

    line_rows: list[dict[str, Any]] = []
    for row in _select(client, "order_lines", "*", order_run_id=order_run_id):
        session = sessions[row["session_id"]]
        caterer = caterers[session["caterer_id"]]
        school = schools[session["school_id"]]
        variant = variants[row["dish_variant_id"]]
        dish = dishes[row["dish_id"]]
        line_rows.append(
            {
                **row,
                "caterer_id": caterer["id"],
                "caterer_name": caterer["name"],
                "school_name": school["canonical_name"],
                "session_date": session["session_date"],
                "dinner_time": session.get("dinner_time"),
                "building": session.get("building"),
                "room": session.get("room"),
                "manager_name": session.get("manager_name"),
                "manager_mobile": session.get("manager_mobile"),
                "variant_name": variant_display_name(dish["name"], variant["name"]),
                "unit_price": format_money(row["unit_price_cents"]),
                "line_total": format_money(row["line_total_cents"]),
            }
        )
    line_rows.sort(
        key=lambda row: (
            row["caterer_name"],
            row["session_date"],
            row["school_name"],
            row["variant_name"],
        )
    )

    allocation_rows: list[dict[str, Any]] = []
    for row in _select(client, "order_allocations", "*", order_run_id=order_run_id):
        session = sessions[row["session_id"]]
        caterer = caterers[session["caterer_id"]]
        school = schools[session["school_id"]]
        student = students[row["student_id"]]
        allocation_rows.append(
            {
                **row,
                "caterer_id": caterer["id"],
                "caterer_name": caterer["name"],
                "school_name": school["canonical_name"],
                "session_date": session["session_date"],
                "student_name": student["full_name"],
                "year_level": student["year_level"],
            }
        )
    allocation_rows.sort(
        key=lambda row: (
            row["session_date"],
            row["school_name"],
            row["student_name"],
            row["status"],
        )
    )

    issue_rows = _select(client, "order_allocation_issues", "*", order_run_id=order_run_id)
    session_delivery = _session_delivery_rows(sessions, schools, caterers, order_run_id, line_rows)
    caterer_summaries = _caterer_summaries(line_rows, allocation_rows, caterers)
    email_drafts = {
        caterer_id: build_caterer_email_draft(
            caterer=summaries["caterer"],
            contacts=contacts_by_caterer.get(caterer_id, []),
            sessions=summaries["sessions"],
            order_lines=summaries["order_lines"],
        )
        for caterer_id, summaries in caterer_summaries.items()
    }

    return {
        "run": run,
        "order_lines": line_rows,
        "allocations": allocation_rows,
        "allocation_counts": status_counts(allocation_rows),
        "issues": issue_rows,
        "session_delivery": session_delivery,
        "contacts_by_caterer": dict(contacts_by_caterer),
        "caterer_summaries": caterer_summaries,
        "email_drafts": email_drafts,
    }


def _session_delivery_rows(
    sessions: dict[str, dict[str, Any]],
    schools: dict[str, dict[str, Any]],
    caterers: dict[str, dict[str, Any]],
    order_run_id: str,
    order_lines: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    session_ids = {row["session_id"] for row in order_lines}
    rows = []
    for session_id in session_ids:
        session = sessions[session_id]
        school = schools[session["school_id"]]
        caterer = caterers[session["caterer_id"]]
        rows.append(
            {
                "order_run_id": order_run_id,
                "session_id": session_id,
                "caterer_id": caterer["id"],
                "caterer_name": caterer["name"],
                "school_name": school["canonical_name"],
                "session_date": session["session_date"],
                "dinner_time": session.get("dinner_time"),
                "building": session.get("building"),
                "room": session.get("room"),
                "missing_room": bool(session.get("building") and not session.get("room")),
                "manager_name": session.get("manager_name"),
                "manager_mobile": session.get("manager_mobile"),
            }
        )
    return sorted(
        rows, key=lambda row: (row["caterer_name"], row["session_date"], row["school_name"])
    )


def _caterer_summaries(
    order_lines: list[dict[str, Any]],
    allocations: list[dict[str, Any]],
    caterers: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    summaries: dict[str, dict[str, Any]] = {}
    lines_by_caterer: dict[str, list[dict[str, Any]]] = defaultdict(list)
    allocations_by_caterer: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in order_lines:
        lines_by_caterer[row["caterer_id"]].append(row)
    for row in allocations:
        allocations_by_caterer[row["caterer_id"]].append(row)
    for caterer_id, lines in lines_by_caterer.items():
        session_map: dict[str, dict[str, Any]] = {}
        for row in lines:
            session_map.setdefault(
                row["session_id"],
                {
                    "session_id": row["session_id"],
                    "school_name": row["school_name"],
                    "session_date": row["session_date"],
                    "dinner_time": row["dinner_time"],
                    "building": row["building"],
                    "room": row["room"],
                    "manager_name": row["manager_name"],
                    "manager_mobile": row["manager_mobile"],
                },
            )
        summaries[caterer_id] = {
            "caterer": caterers[caterer_id],
            "order_lines": lines,
            "sessions": sorted(
                session_map.values(), key=lambda row: (row["session_date"], row["school_name"])
            ),
            "meal_count": sum(row["quantity"] for row in lines),
            "subtotal_cents": sum(row["line_total_cents"] for row in lines),
            "allocation_counts": status_counts(allocations_by_caterer[caterer_id]),
        }
    return summaries


def build_caterer_email_draft(
    caterer: dict[str, Any],
    contacts: list[dict[str, Any]],
    sessions: list[dict[str, Any]],
    order_lines: list[dict[str, Any]],
) -> str:
    contact_emails = [str(contact["email"]) for contact in contacts if contact.get("email")]
    warnings = [contact for contact in contacts if contact.get("warning")]
    subtotal_cents = sum(row["line_total_cents"] for row in order_lines)
    total_meals = sum(row["quantity"] for row in order_lines)

    lines = [
        f"To: {', '.join(contact_emails) if contact_emails else '[confirm caterer email]'}",
        f"Subject: Padea catering order - {caterer['name']}",
        "",
    ]
    if warnings:
        lines.append("CONTACT REVIEW REQUIRED:")
        for contact in warnings:
            lines.append(
                f"- {contact['display_name']} <{contact.get('email') or 'no email'}>: "
                f"{contact['warning']}"
            )
        lines.append("")

    lines.extend(
        [
            f"Hi {caterer['name']},",
            "",
            "Please prepare the following Padea tutoring meals:",
            "",
        ]
    )

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
        lines.extend(
            [
                session_heading,
                f"Delivery: {destination}",
                f"Manager contact: {session.get('manager_name') or 'TBC'} "
                f"{session.get('manager_mobile') or ''}".strip(),
            ]
        )
        if session.get("building") and not session.get("room"):
            lines.append("Note: room number is not recorded; please call the manager on arrival.")
        for order_line in lines_by_session.get(session["session_id"], []):
            lines.append(f"- {order_line['quantity']} x {order_line['variant_name']}")
        lines.append("")

    lines.extend(
        [
            f"Total meals: {total_meals}",
            f"Item subtotal: {format_money(subtotal_cents)}",
        ]
    )
    if caterer.get("delivery_fee_cents"):
        lines.append(
            f"Delivery fee noted in system: {format_money(caterer['delivery_fee_cents'])} "
            f"({caterer.get('delivery_scope') or 'scope unknown'})"
        )
    lines.extend(["", "Thanks,", "Padea"])
    return "\n".join(lines)
