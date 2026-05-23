"""Unit tests for audited operational actions."""

from __future__ import annotations

import pytest

from padea_catering.operations import approve_order_run, record_manual_override, unapprove_order_run


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, table: FakeTable, operation: str, payload=None):
        self.table = table
        self.operation = operation
        self.payload = payload
        self.filters = {}

    def select(self, _columns: str = "*"):
        self.operation = "select"
        return self

    def eq(self, key: str, value):
        self.filters[key] = value
        return self

    def execute(self):
        rows = self.table.rows
        if self.operation == "select":
            return FakeResult([row.copy() for row in rows if self._matches(row)])
        if self.operation == "update":
            updated = []
            for row in rows:
                if self._matches(row):
                    row.update(self.payload)
                    updated.append(row.copy())
            return FakeResult(updated)
        if self.operation == "insert":
            payload = self.payload.copy()
            payload.setdefault("id", f"{self.table.name}-{len(rows) + 1}")
            payload.setdefault("created_at", f"2026-05-22T00:00:0{len(rows)}")
            rows.append(payload)
            return FakeResult([payload.copy()])
        raise AssertionError(self.operation)

    def _matches(self, row):
        return all(row.get(key) == value for key, value in self.filters.items())


class FakeTable:
    def __init__(self, name: str, rows: list[dict]):
        self.name = name
        self.rows = rows

    def select(self, columns: str = "*"):
        return FakeQuery(self, "select").select(columns)

    def update(self, payload: dict):
        return FakeQuery(self, "update", payload)

    def insert(self, payload: dict):
        return FakeQuery(self, "insert", payload)


class FakeClient:
    def __init__(self):
        self.tables = {
            "order_runs": FakeTable(
                "order_runs",
                [
                    {
                        "id": "run-1",
                        "status": "generated",
                        "approved_at": None,
                        "approved_by": None,
                        "approval_note": None,
                    }
                ],
            ),
            "audit_log": FakeTable("audit_log", []),
            "manual_overrides": FakeTable("manual_overrides", []),
        }

    def table(self, name: str):
        return self.tables[name]


def test_approve_order_run_requires_actor_and_reason() -> None:
    client = FakeClient()

    with pytest.raises(ValueError, match="actor_name is required"):
        approve_order_run(client, "run-1", "", "Reviewed")
    with pytest.raises(ValueError, match="reason is required"):
        approve_order_run(client, "run-1", "Operator", "")


def test_approve_order_run_updates_status_and_writes_audit() -> None:
    client = FakeClient()

    result = approve_order_run(client, "run-1", "Operator", "Reviewed")

    assert result["status"] == "approved"
    assert result["approved_by"] == "Operator"
    assert client.tables["order_runs"].rows[0]["status"] == "approved"
    assert client.tables["audit_log"].rows[0]["action"] == "order_run_approved"
    assert client.tables["audit_log"].rows[0]["before_state"]["status"] == "generated"


def test_approve_order_run_rejects_blocked_run() -> None:
    client = FakeClient()
    client.tables["order_runs"].rows[0]["status"] = "blocked"

    with pytest.raises(ValueError, match="Only generated"):
        approve_order_run(client, "run-1", "Operator", "Reviewed")


def test_unapprove_order_run_reopens_approved_run_and_writes_audit() -> None:
    client = FakeClient()
    approve_order_run(client, "run-1", "Operator", "Reviewed")

    result = unapprove_order_run(client, "run-1", "Operator", "Need correction")

    assert result["status"] == "generated"
    assert result["approved_by"] is None
    assert client.tables["audit_log"].rows[-1]["action"] == "order_run_unapproved"


def test_record_manual_override_writes_override_and_audit() -> None:
    client = FakeClient()

    result = record_manual_override(
        client,
        order_run_id="run-1",
        actor_name="Operator",
        override_type="other",
        entity_type="order_run",
        entity_id="run-1",
        reason="Documented exception",
        before_state={"status": "generated"},
        after_state={"status": "generated"},
    )

    assert result["override_type"] == "other"
    assert client.tables["manual_overrides"].rows[0]["reason"] == "Documented exception"
    assert client.tables["audit_log"].rows[0]["action"] == "manual_override_created"


def test_record_manual_override_validates_override_type() -> None:
    client = FakeClient()

    with pytest.raises(ValueError, match="override_type"):
        record_manual_override(
            client,
            order_run_id="run-1",
            actor_name="Operator",
            override_type="bad",
            entity_type="order_run",
            entity_id="run-1",
            reason="Documented exception",
        )
