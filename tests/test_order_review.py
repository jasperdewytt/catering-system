"""Unit tests for order review formatting helpers."""

from __future__ import annotations

from padea_catering.order_review import (
    build_caterer_email_draft,
    format_money,
    get_order_review,
    select_default_order_run_id,
    status_counts,
    variant_display_name,
)
from tests.test_operations import FakeClient, FakeResult


def test_variant_display_name_uses_parent_for_standard() -> None:
    assert variant_display_name("Cali Burrito", "Standard") == "Cali Burrito"
    assert variant_display_name("Cali Burrito", "Vegetarian") == "Cali Burrito - Vegetarian"


def test_select_default_order_run_prefers_latest_generated() -> None:
    runs = [
        {"id": "blocked", "status": "blocked", "generated_at": "2026-05-22T12:00:00"},
        {"id": "old", "status": "generated", "generated_at": "2026-05-22T10:00:00"},
        {"id": "new", "status": "generated", "generated_at": "2026-05-22T11:00:00"},
    ]

    assert select_default_order_run_id(runs) == "new"


def test_status_counts_counts_allocation_statuses() -> None:
    rows = [
        {"status": "allocated"},
        {"status": "allocated"},
        {"status": "skipped_absent"},
    ]

    assert status_counts(rows) == {"allocated": 2, "skipped_absent": 1}


def test_format_money_uses_cents() -> None:
    assert format_money(1234) == "$12.34"


def test_email_draft_includes_missing_room_manager_mobile() -> None:
    draft = build_caterer_email_draft(
        caterer={
            "name": "Example Caterer",
            "delivery_fee_cents": 1000,
            "delivery_scope": "per_school_per_trip",
        },
        contacts=[
            {
                "display_name": "Primary",
                "email": "primary@example.com",
                "warning": None,
            }
        ],
        sessions=[
            {
                "session_id": "s1",
                "school_name": "Example School",
                "session_date": "2026-05-01",
                "dinner_time": "18:00:00",
                "building": "Library",
                "room": None,
                "manager_name": "Jessie",
                "manager_mobile": "0412 345 678",
            }
        ],
        order_lines=[
            {
                "session_id": "s1",
                "quantity": 3,
                "variant_name": "Cali Burrito - Vegetarian",
                "line_total_cents": 3600,
            }
        ],
    )

    assert "3 x Cali Burrito - Vegetarian" in draft
    assert "please call the manager on arrival" in draft
    assert "Jessie 0412 345 678" in draft
    assert "Item subtotal: $36.00" in draft


def test_get_order_review_includes_audit_history() -> None:
    client = FakeClient()
    client.tables["order_runs"].rows[0].update(
        {
            "service_week_start": "2026-05-01",
            "service_week_end": "2026-05-07",
            "algorithm_version": "deterministic-v1",
            "generated_by": "Operator",
            "generated_at": "2026-05-22T00:00:00",
            "issue_count": 0,
            "created_at": "2026-05-22T00:00:00",
        }
    )
    client.tables["audit_log"].rows.append(
        {
            "id": "audit-1",
            "order_run_id": "run-1",
            "actor_name": "Operator",
            "action": "order_run_approved",
            "entity_type": "order_run",
            "entity_id": "run-1",
            "reason": "Reviewed",
            "before_state": {},
            "after_state": {},
            "created_at": "2026-05-22T00:00:00",
        }
    )
    client.tables.update(
        {
            "schools": _fake_table("schools"),
            "caterers": _fake_table("caterers"),
            "sessions": _fake_table("sessions"),
            "dishes": _fake_table("dishes"),
            "dish_variants": _fake_table("dish_variants"),
            "students": _fake_table("students"),
            "caterer_contacts": _fake_table("caterer_contacts"),
            "order_lines": _fake_table("order_lines"),
            "order_allocations": _fake_table("order_allocations"),
            "order_allocation_issues": _fake_table("order_allocation_issues"),
        }
    )

    review = get_order_review(client, "run-1")

    assert review["audit_history"][0]["id"] == "audit-1"


class _fake_table:
    def __init__(self, name: str):
        self.name = name
        self.rows = []

    def select(self, _columns: str = "*"):
        return self

    def eq(self, _key: str, _value):
        return self

    def execute(self):
        return FakeResult([])
