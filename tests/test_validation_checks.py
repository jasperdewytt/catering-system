"""Focused tests for validation checks."""

from __future__ import annotations

from padea_catering.validation.checks import check_caterer_contact_emails, check_missing_rooms
from tests.test_operations import FakeClient, FakeTable


def test_building_without_room_produces_no_warning() -> None:
    client = FakeClient()

    assert check_missing_rooms(client) == []


def test_free_webmail_contact_produces_no_suspicious_email_warning() -> None:
    client = FakeClient()
    client.tables.update(
        {
            "caterers": FakeTable("caterers", [{"id": "cat-1", "name": "Example Caterer"}]),
            "caterer_contacts": FakeTable(
                "caterer_contacts",
                [
                    {
                        "id": "contact-1",
                        "caterer_id": "cat-1",
                        "display_name": "Primary",
                        "email": "primary@gmail.com",
                        "is_verified": True,
                        "cc_preference": "to",
                    }
                ],
            ),
        }
    )

    findings = check_caterer_contact_emails(client)

    assert [finding.category for finding in findings] == []


def test_missing_contact_email_is_reported_as_info() -> None:
    client = FakeClient()
    client.tables.update(
        {
            "caterers": FakeTable("caterers", [{"id": "cat-1", "name": "Example Caterer"}]),
            "caterer_contacts": FakeTable(
                "caterer_contacts",
                [
                    {
                        "id": "contact-1",
                        "caterer_id": "cat-1",
                        "display_name": "Primary",
                        "email": None,
                        "is_verified": True,
                        "cc_preference": "to",
                    }
                ],
            ),
        }
    )

    findings = check_caterer_contact_emails(client)

    assert findings[0].severity == "info"
    assert findings[0].category == "missing_contact_email"
