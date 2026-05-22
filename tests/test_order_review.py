"""Unit tests for order review formatting helpers."""

from __future__ import annotations

from padea_catering.order_review import (
    build_caterer_email_draft,
    format_money,
    select_default_order_run_id,
    status_counts,
    variant_display_name,
)


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
