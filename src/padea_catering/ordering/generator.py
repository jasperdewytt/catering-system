"""Supabase-backed deterministic order generation."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from typing import Any

from supabase import Client

from .rules import DishOption, choose_dish

ALGORITHM_VERSION = "deterministic-v1"
BLOCKING_ISSUE_CODES = {
    "pending_dietary_warning",
    "no_menu_offer",
    "no_safe_dish",
}


@dataclass(frozen=True)
class AllocationDraft:
    session_id: str
    student_id: str
    dish_id: str | None
    status: str
    reason_codes: list[str]
    dietary_tag_codes: list[str]


@dataclass(frozen=True)
class OrderLineDraft:
    session_id: str
    dish_id: str
    quantity: int
    unit_price_cents: int
    gst_inclusive: bool
    line_total_cents: int


@dataclass(frozen=True)
class IssueDraft:
    severity: str
    code: str
    message: str
    session_id: str | None = None
    student_id: str | None = None
    dish_id: str | None = None
    details: dict[str, Any] | None = None


@dataclass(frozen=True)
class OrderPlan:
    service_week_start: date
    service_week_end: date
    allocations: list[AllocationDraft]
    order_lines: list[OrderLineDraft]
    issues: list[IssueDraft]
    input_snapshot: dict[str, Any]

    @property
    def has_blockers(self) -> bool:
        return any(issue.severity == "error" for issue in self.issues)


def _select(client: Client, table: str, columns: str = "*") -> list[dict[str, Any]]:
    return client.table(table).select(columns).execute().data


def _week_end(week_start: date) -> date:
    return week_start + timedelta(days=6)


def _in_week(session: dict[str, Any], week_start: date, week_end: date) -> bool:
    session_date = date.fromisoformat(session["session_date"])
    return week_start <= session_date <= week_end


def _dish_option(row: dict[str, Any]) -> DishOption:
    return DishOption(
        id=row["id"],
        name=row["name"],
        is_gluten_free=row["is_gluten_free"],
        is_dairy_free=row["is_dairy_free"],
        is_nut_free=row["is_nut_free"],
        is_vegetarian_option=row["is_vegetarian_option"],
        is_halal_inferred=row["is_halal_inferred"],
        has_no_declared_tags=row["has_no_declared_tags"],
        contains_beef=row.get("contains_beef", False),
        contains_pork=row.get("contains_pork", False),
        contains_red_meat=row.get("contains_red_meat", False),
        contains_fish=row.get("contains_fish", False),
        contains_shellfish=row.get("contains_shellfish", False),
        ingredient_flags_source=row.get("ingredient_flags_source", "unreviewed"),
    )


def build_order_plan(client: Client, service_week_start: date) -> OrderPlan:
    """Build a deterministic order plan without writing to the database."""
    service_week_end = _week_end(service_week_start)

    schools = {row["id"]: row for row in _select(client, "schools", "id, canonical_name")}
    caterers = {
        row["id"]: row
        for row in _select(
            client,
            "caterers",
            "id, name, per_item_price_cents, gst_inclusive",
        )
    }
    sessions = [
        row
        for row in _select(
            client,
            "sessions",
            "id, school_id, caterer_id, session_date, year_levels",
        )
        if _in_week(row, service_week_start, service_week_end)
    ]
    sessions.sort(
        key=lambda row: (
            row["session_date"],
            schools.get(row["school_id"], {}).get("canonical_name", ""),
            row["id"],
        )
    )
    session_by_id = {row["id"]: row for row in sessions}

    students = {
        row["id"]: row
        for row in _select(client, "students", "id, full_name, year_level, opted_out")
    }
    enrolments = [
        row
        for row in _select(client, "session_enrolments", "session_id, student_id")
        if row["session_id"] in session_by_id
    ]
    enrolments_by_session: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for enrolment in enrolments:
        enrolments_by_session[enrolment["session_id"]].append(enrolment)
    for session_id in enrolments_by_session:
        enrolments_by_session[session_id].sort(
            key=lambda row: (
                students.get(row["student_id"], {}).get("full_name", ""),
                row["student_id"],
            )
        )

    tag_rows = _select(client, "student_dietary_tags", "student_id, tag_code")
    tags_by_student: dict[str, set[str]] = defaultdict(set)
    for row in tag_rows:
        tags_by_student[row["student_id"]].add(row["tag_code"])

    pending_warning_students = {
        row["student_id"]
        for row in _select(client, "student_dietary_warnings", "student_id, status")
        if row["status"] == "pending"
    }
    excluded_years_by_session = {
        row["session_id"]: set(row["excluded_year_levels"])
        for row in _select(client, "exclusions", "session_id, excluded_year_levels")
    }
    absent_pairs = {
        (row["session_id"], row["student_id"])
        for row in _select(client, "absences", "session_id, student_id")
    }

    dishes = {
        row["id"]: row
        for row in _select(
            client,
            "dishes",
            (
                "id, caterer_id, name, is_gluten_free, is_dairy_free, is_nut_free, "
                "is_vegetarian_option, is_halal_inferred, has_no_declared_tags, "
                "contains_beef, contains_pork, contains_red_meat, contains_fish, "
                "contains_shellfish, ingredient_flags_source"
            ),
        )
    }
    offers = [
        row
        for row in _select(client, "menu_offers", "id, service_week_start, dish_id")
        if row["service_week_start"] == service_week_start.isoformat()
    ]
    offered_by_caterer: dict[str, list[DishOption]] = defaultdict(list)
    offered_dish_ids: list[str] = []
    for offer in offers:
        dish = dishes.get(offer["dish_id"])
        if dish is None:
            continue
        offered_dish_ids.append(offer["dish_id"])
        offered_by_caterer[dish["caterer_id"]].append(_dish_option(dish))
    for caterer_id in offered_by_caterer:
        offered_by_caterer[caterer_id].sort(key=lambda dish: (dish.name, dish.id))

    allocations: list[AllocationDraft] = []
    issues: list[IssueDraft] = []
    line_counts: Counter[tuple[str, str]] = Counter()
    session_dish_counts: dict[str, dict[str, int]] = defaultdict(dict)
    no_offer_issue_sessions: set[str] = set()

    for session in sessions:
        session_id = session["id"]
        caterer_id = session["caterer_id"]
        offered_dishes = offered_by_caterer.get(caterer_id, [])
        excluded_years = excluded_years_by_session.get(session_id, set())
        for enrolment in enrolments_by_session.get(session_id, []):
            student_id = enrolment["student_id"]
            student = students.get(student_id)
            if student is None:
                continue
            tag_codes = sorted(tags_by_student.get(student_id, set()))
            tag_set = set(tag_codes)

            if student["opted_out"]:
                allocations.append(
                    AllocationDraft(
                        session_id=session_id,
                        student_id=student_id,
                        dish_id=None,
                        status="skipped_opted_out",
                        reason_codes=["opted_out"],
                        dietary_tag_codes=tag_codes,
                    )
                )
                continue
            if (session_id, student_id) in absent_pairs:
                allocations.append(
                    AllocationDraft(
                        session_id=session_id,
                        student_id=student_id,
                        dish_id=None,
                        status="skipped_absent",
                        reason_codes=["absent"],
                        dietary_tag_codes=tag_codes,
                    )
                )
                continue
            if student["year_level"] in excluded_years:
                allocations.append(
                    AllocationDraft(
                        session_id=session_id,
                        student_id=student_id,
                        dish_id=None,
                        status="skipped_year_excluded",
                        reason_codes=["year_excluded"],
                        dietary_tag_codes=tag_codes,
                    )
                )
                continue
            if student_id in pending_warning_students:
                allocations.append(
                    AllocationDraft(
                        session_id=session_id,
                        student_id=student_id,
                        dish_id=None,
                        status="blocked_pending_dietary_warning",
                        reason_codes=["pending_dietary_warning"],
                        dietary_tag_codes=tag_codes,
                    )
                )
                issues.append(
                    IssueDraft(
                        severity="error",
                        code="pending_dietary_warning",
                        message=(
                            f"{student['full_name']} has pending dietary text requiring "
                            "operator review."
                        ),
                        session_id=session_id,
                        student_id=student_id,
                    )
                )
                continue
            if not offered_dishes:
                allocations.append(
                    AllocationDraft(
                        session_id=session_id,
                        student_id=student_id,
                        dish_id=None,
                        status="blocked_no_menu_offer",
                        reason_codes=["no_menu_offer"],
                        dietary_tag_codes=tag_codes,
                    )
                )
                if session_id not in no_offer_issue_sessions:
                    no_offer_issue_sessions.add(session_id)
                    caterer_name = caterers.get(caterer_id, {}).get("name", caterer_id)
                    school_name = schools.get(session["school_id"], {}).get("canonical_name", "?")
                    issues.append(
                        IssueDraft(
                            severity="error",
                            code="no_menu_offer",
                            message=(
                                f"{school_name} on {session['session_date']}: {caterer_name} "
                                "has no offered dishes for this week."
                            ),
                            session_id=session_id,
                            details={"caterer_id": caterer_id},
                        )
                    )
                continue

            chosen = choose_dish(offered_dishes, tag_set, session_dish_counts[session_id])
            if chosen is None:
                allocations.append(
                    AllocationDraft(
                        session_id=session_id,
                        student_id=student_id,
                        dish_id=None,
                        status="blocked_no_safe_dish",
                        reason_codes=["no_safe_dish"],
                        dietary_tag_codes=tag_codes,
                    )
                )
                issues.append(
                    IssueDraft(
                        severity="error",
                        code="no_safe_dish",
                        message=f"{student['full_name']} has no safe offered dish.",
                        session_id=session_id,
                        student_id=student_id,
                        details={"dietary_tag_codes": tag_codes, "caterer_id": caterer_id},
                    )
                )
                continue

            session_dish_counts[session_id][chosen.id] = (
                session_dish_counts[session_id].get(chosen.id, 0) + 1
            )
            line_counts[(session_id, chosen.id)] += 1
            allocations.append(
                AllocationDraft(
                    session_id=session_id,
                    student_id=student_id,
                    dish_id=chosen.id,
                    status="allocated",
                    reason_codes=[],
                    dietary_tag_codes=tag_codes,
                )
            )

    order_lines: list[OrderLineDraft] = []
    for (session_id, dish_id), quantity in sorted(line_counts.items()):
        session = session_by_id[session_id]
        caterer = caterers[session["caterer_id"]]
        unit_price = caterer["per_item_price_cents"]
        order_lines.append(
            OrderLineDraft(
                session_id=session_id,
                dish_id=dish_id,
                quantity=quantity,
                unit_price_cents=unit_price,
                gst_inclusive=caterer["gst_inclusive"],
                line_total_cents=unit_price * quantity,
            )
        )

    snapshot = {
        "algorithm_version": ALGORITHM_VERSION,
        "service_week_start": service_week_start.isoformat(),
        "service_week_end": service_week_end.isoformat(),
        "session_ids": [session["id"] for session in sessions],
        "offered_dish_ids": sorted(offered_dish_ids),
        "source_counts": {
            "sessions": len(sessions),
            "enrolments": len(enrolments),
            "students": len(students),
            "dishes": len(dishes),
            "menu_offers": len(offers),
        },
    }
    return OrderPlan(
        service_week_start=service_week_start,
        service_week_end=service_week_end,
        allocations=allocations,
        order_lines=order_lines,
        issues=issues,
        input_snapshot=snapshot,
    )


def generate_order_run(
    client: Client,
    service_week_start: date,
    generated_by: str | None = None,
) -> dict[str, Any]:
    """Build and persist an order run. Previous draft/generated runs are superseded."""
    plan = build_order_plan(client, service_week_start)
    status = "blocked" if plan.has_blockers else "generated"

    client.table("order_runs").update({"status": "superseded"}).eq(
        "service_week_start", service_week_start.isoformat()
    ).in_("status", ["blocked", "generated"]).execute()

    run_row = {
        "service_week_start": plan.service_week_start.isoformat(),
        "service_week_end": plan.service_week_end.isoformat(),
        "status": status,
        "algorithm_version": ALGORITHM_VERSION,
        "generated_by": generated_by,
        "input_snapshot": plan.input_snapshot,
        "issue_count": len(plan.issues),
    }
    inserted_run = client.table("order_runs").insert(run_row).execute().data[0]
    run_id = inserted_run["id"]

    if plan.allocations:
        client.table("order_allocations").insert(
            [
                {
                    "order_run_id": run_id,
                    **asdict(allocation),
                }
                for allocation in plan.allocations
            ]
        ).execute()

    if not plan.has_blockers and plan.order_lines:
        client.table("order_lines").insert(
            [{"order_run_id": run_id, **asdict(line)} for line in plan.order_lines]
        ).execute()

    if plan.issues:
        client.table("order_allocation_issues").insert(
            [
                {
                    "order_run_id": run_id,
                    "session_id": issue.session_id,
                    "student_id": issue.student_id,
                    "dish_id": issue.dish_id,
                    "severity": issue.severity,
                    "code": issue.code,
                    "message": issue.message,
                    "details": issue.details or {},
                }
                for issue in plan.issues
            ]
        ).execute()

    return {
        "order_run_id": run_id,
        "status": status,
        "allocations": len(plan.allocations),
        "order_lines": 0 if plan.has_blockers else len(plan.order_lines),
        "issues": len(plan.issues),
    }
