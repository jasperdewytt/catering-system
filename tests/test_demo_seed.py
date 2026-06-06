"""Unit tests for deterministic final-round demo seed builders."""

from __future__ import annotations

from datetime import date

from padea_catering.demo_seed import (
    CANONICAL_TAG_CODES,
    DEMO_SEED_NOTES,
    DemoSeedPlan,
    assign_student_archetype,
    build_dish_variant_tag_rows,
    build_fit_debt_rows,
    build_student_history_rows,
    dish_name_to_tag_codes,
    reset_filters_for_plan,
    signal_rows_for_student,
)


def test_dish_name_to_tag_mapping_uses_only_canonical_tags() -> None:
    for name in [
        "Chicken Burrito - Standard",
        "Vegetarian Sushi Box",
        "Beef Pasta Bake",
        "Mystery Demo Meal",
    ]:
        assert set(dish_name_to_tag_codes(name)) <= CANONICAL_TAG_CODES


def test_dish_variant_tag_rows_are_manual_demo_tags() -> None:
    rows = build_dish_variant_tag_rows(
        [
            {
                "id": "variant-1",
                "dish_id": "dish-1",
                "dish_name": "Chicken Burrito",
                "name": "Standard",
            }
        ]
    )

    assert rows
    assert {row["tag_source"] for row in rows} == {"manual"}
    assert {row["confidence"] for row in rows} == {1.0}
    assert {row["notes"] for row in rows} == {DEMO_SEED_NOTES}
    assert {row["tag_code"] for row in rows} <= CANONICAL_TAG_CODES


def test_student_archetype_assignment_is_stable() -> None:
    student = {"id": "student-1", "full_name": "Avery Smith", "opted_out": False}

    assert assign_student_archetype(student) == assign_student_archetype(student)


def test_student_preference_signals_stay_within_schema_ranges() -> None:
    rows = signal_rows_for_student(
        {"id": "student-1", "full_name": "Avery Smith", "opted_out": False},
        date(2026, 5, 1),
    )

    assert rows
    for row in rows:
        assert -1 <= row["affinity_score"] <= 1
        assert 0 <= row["confidence"] <= 1
        assert row["feedback_count"] >= 1
        assert row["tag_code"] in CANONICAL_TAG_CODES


def test_generated_feedback_satisfies_required_content_check() -> None:
    students = [
        {"id": f"student-{index}", "full_name": f"Student {index}", "opted_out": False}
        for index in range(20)
    ]
    enrolments_by_student = {student["id"]: ["session-1"] for student in students}
    sessions_by_id = {"session-1": {"id": "session-1", "session_date": "2026-05-01"}}
    variants = [
        {
            "id": "variant-1",
            "dish_id": "dish-1",
            "dish_name": "Chicken Burrito",
            "name": "Standard",
        },
        {
            "id": "variant-2",
            "dish_id": "dish-2",
            "dish_name": "Garden Salad",
            "name": "Standard",
        },
    ]
    dish_tag_rows = build_dish_variant_tag_rows(variants)

    feedback_rows, signal_rows, seeded_student_ids, signal_tag_codes = build_student_history_rows(
        students=students,
        enrolments_by_student=enrolments_by_student,
        sessions_by_id=sessions_by_id,
        variants=variants,
        dish_tag_rows=dish_tag_rows,
        week_start=date(2026, 5, 1),
    )

    assert feedback_rows
    assert signal_rows
    assert seeded_student_ids
    assert signal_tag_codes
    for row in feedback_rows:
        assert row["source"] == "demo_seed"
        assert row["metadata"]["demo_seed"] is True
        assert (
            row["rating"] is not None
            or row["liked"] is not None
            or row["free_text"]
            or row["requested_food"]
        )
        if row["rating"] is not None:
            assert 1 <= row["rating"] <= 5


def test_fit_debt_rows_have_expected_week_and_non_negative_scores() -> None:
    rows, student_ids = build_fit_debt_rows(
        [f"student-{index}" for index in range(20)],
        date(2026, 5, 1),
    )

    assert rows
    assert len(rows) == len(student_ids)
    for row in rows:
        assert row["service_week_start"] == "2026-05-01"
        assert row["fit_debt_score"] >= 0
        assert row["decayed_from_previous"] >= 0
        assert row["reason"]


def test_reset_filters_target_only_demo_rows_or_seeded_scope() -> None:
    plan = DemoSeedPlan(
        week_start=date(2026, 5, 1),
        seeded_student_ids=["student-1", "student-2"],
        seeded_signal_tag_codes=["wrap", "salad"],
        fit_debt_student_ids=["student-1"],
    )

    filters = reset_filters_for_plan(plan)

    assert any(
        item.table == "student_meal_feedback"
        and item.column == "source"
        and item.operator == "eq"
        and item.value == "demo_seed"
        for item in filters
    )
    assert any(
        item.table == "dish_variant_tags"
        and item.column == "notes"
        and item.operator == "eq"
        and item.value == DEMO_SEED_NOTES
        for item in filters
    )
    assert any(
        item.table == "autopilot_runs"
        and item.column == "metadata"
        and item.operator == "contains"
        and item.value == {"demo_seed": True}
        for item in filters
    )
    assert any(
        item.table == "student_fit_debt"
        and item.column == "student_id"
        and item.operator == "in"
        and item.value == ["student-1"]
        for item in filters
    )
    assert any(
        item.table == "student_preference_signals"
        and item.column == "tag_code"
        and item.operator == "in"
        and item.value == ["wrap", "salad"]
        for item in filters
    )
    assert all(item.operator != "neq" for item in filters)
