"""Deterministic final-round demo seed data builders and Supabase apply helpers."""

from __future__ import annotations

import hashlib
import json
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any

from supabase import Client

DEMO_SEED_NOTES = "demo_seed:v1"
DEMO_SEED_VERSION = "v1"
DEMO_SEED_PROVIDER = "demo_seed"
DEMO_SEED_NAMESPACE = uuid.UUID("2dd8a401-d975-4bd4-a7d0-d2f266d8c04e")

CANONICAL_TAG_CODES = {
    "mexican",
    "italian",
    "japanese",
    "asian",
    "middle_eastern",
    "modern_australian",
    "american",
    "mediterranean",
    "wrap",
    "bowl",
    "pasta",
    "rice",
    "salad",
    "sandwich",
    "burger",
    "pizza",
    "sushi",
    "snack",
    "dessert",
    "noodle",
    "curry",
    "spicy",
    "mild",
    "creamy",
    "cheesy",
    "saucy",
    "fresh",
    "crispy",
    "hot_food",
    "cold_food",
    "plain",
    "chicken_style",
    "beef_style",
    "seafood_style",
    "vegetarian_style",
    "plant_based",
    "egg_style",
    "familiar_food",
    "light_meal",
    "filling_meal",
    "sweet",
    "savory",
    "easy_to_eat",
    "customisable",
    "other_for_review",
}


@dataclass(frozen=True)
class StudentArchetype:
    code: str
    label: str
    positive_tags: tuple[str, ...]
    negative_tags: tuple[str, ...]
    liked_phrase: str
    disliked_phrase: str
    request_phrase: str


ARCHETYPES = (
    StudentArchetype(
        code="familiar_handheld",
        label="Familiar handheld",
        positive_tags=(
            "wrap",
            "sandwich",
            "burger",
            "pizza",
            "familiar_food",
            "easy_to_eat",
            "chicken_style",
            "cheesy",
        ),
        negative_tags=("salad", "light_meal", "spicy", "seafood_style"),
        liked_phrase="liked the familiar handheld option and finished most of it",
        disliked_phrase="did not want the lighter salad-style option",
        request_phrase="asked for simple wraps or pizza again",
    ),
    StudentArchetype(
        code="rice_bowl",
        label="Rice bowl",
        positive_tags=("asian", "rice", "bowl", "saucy", "chicken_style", "hot_food"),
        negative_tags=("plain", "salad", "cold_food"),
        liked_phrase="responded well to warm saucy rice meals",
        disliked_phrase="found a plain cold option boring",
        request_phrase="asked for rice bowls with sauce",
    ),
    StudentArchetype(
        code="fresh_light",
        label="Fresh and light",
        positive_tags=(
            "salad",
            "fresh",
            "light_meal",
            "mediterranean",
            "vegetarian_style",
            "cold_food",
        ),
        negative_tags=("burger", "creamy", "cheesy", "filling_meal"),
        liked_phrase="preferred the fresh lighter meal and left very little",
        disliked_phrase="said the heavy cheesy option was too much before tutoring",
        request_phrase="asked for fresh bowls or salad options",
    ),
    StudentArchetype(
        code="comfort_hot",
        label="Hot comfort",
        positive_tags=("pasta", "italian", "creamy", "cheesy", "hot_food", "filling_meal"),
        negative_tags=("spicy", "cold_food", "salad"),
        liked_phrase="was happiest with the hot pasta-style comfort meal",
        disliked_phrase="skipped most of the cold spicy option",
        request_phrase="asked for pasta or warm cheesy meals",
    ),
    StudentArchetype(
        code="adventurous",
        label="Adventurous flavours",
        positive_tags=(
            "mexican",
            "japanese",
            "middle_eastern",
            "spicy",
            "curry",
            "noodle",
            "sushi",
        ),
        negative_tags=("plain", "familiar_food", "mild"),
        liked_phrase="liked the stronger flavour profile and wanted more variety",
        disliked_phrase="was not interested in the plain familiar meal",
        request_phrase="asked to try sushi, curry, or Mexican options",
    ),
    StudentArchetype(
        code="veg_plant",
        label="Vegetarian leaning",
        positive_tags=(
            "vegetarian_style",
            "plant_based",
            "fresh",
            "salad",
            "bowl",
            "mediterranean",
        ),
        negative_tags=("beef_style", "seafood_style", "burger"),
        liked_phrase="preferred the vegetable-forward meal",
        disliked_phrase="avoided the meat-forward option",
        request_phrase="asked for vegetarian bowls or wraps",
    ),
)


@dataclass(frozen=True)
class ResetFilter:
    table: str
    column: str
    operator: str
    value: Any


@dataclass
class DemoSeedPlan:
    week_start: date
    dish_variant_tags: list[dict[str, Any]] = field(default_factory=list)
    student_meal_feedback: list[dict[str, Any]] = field(default_factory=list)
    student_preference_signals: list[dict[str, Any]] = field(default_factory=list)
    student_fit_debt: list[dict[str, Any]] = field(default_factory=list)
    session_catering_feedback: list[dict[str, Any]] = field(default_factory=list)
    caterer_quality_events: list[dict[str, Any]] = field(default_factory=list)
    caterer_reply_intake: list[dict[str, Any]] = field(default_factory=list)
    ai_interpretations: list[dict[str, Any]] = field(default_factory=list)
    reply_ai_links: list[tuple[str, str]] = field(default_factory=list)
    autopilot_runs: list[dict[str, Any]] = field(default_factory=list)
    autopilot_exceptions: list[dict[str, Any]] = field(default_factory=list)
    seeded_student_ids: list[str] = field(default_factory=list)
    seeded_signal_tag_codes: list[str] = field(default_factory=list)
    fit_debt_student_ids: list[str] = field(default_factory=list)
    examples: dict[str, Any] = field(default_factory=dict)

    @property
    def counts(self) -> dict[str, int]:
        return {
            "dish_variant_tags": len(self.dish_variant_tags),
            "student_meal_feedback": len(self.student_meal_feedback),
            "student_preference_signals": len(self.student_preference_signals),
            "student_fit_debt": len(self.student_fit_debt),
            "session_catering_feedback": len(self.session_catering_feedback),
            "caterer_quality_events": len(self.caterer_quality_events),
            "caterer_reply_intake": len(self.caterer_reply_intake),
            "ai_interpretations": len(self.ai_interpretations),
            "autopilot_runs": len(self.autopilot_runs),
            "autopilot_exceptions": len(self.autopilot_exceptions),
        }


def stable_uuid(key: str) -> str:
    return str(uuid.uuid5(DEMO_SEED_NAMESPACE, key))


def stable_int(key: str) -> int:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def stable_float(key: str, minimum: float, maximum: float, digits: int = 4) -> float:
    ratio = stable_int(key) / float(0xFFFFFFFFFFFFFFFF)
    return round(minimum + ((maximum - minimum) * ratio), digits)


def stable_hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def demo_metadata(**extra: Any) -> dict[str, Any]:
    return {"demo_seed": True, "demo_seed_version": DEMO_SEED_VERSION, **extra}


def validate_tag_codes(tag_codes: set[str], canonical_tag_codes: set[str] | None = None) -> None:
    valid = canonical_tag_codes or CANONICAL_TAG_CODES
    unknown = sorted(tag_codes - valid)
    if unknown:
        raise ValueError(f"Unknown preference tag codes: {unknown}")


def display_variant_name(variant: dict[str, Any]) -> str:
    dish_name = variant.get("dish_name") or variant.get("name") or "Dish"
    variant_name = variant.get("name") or "Standard"
    return dish_name if variant_name == "Standard" else f"{dish_name} - {variant_name}"


def dish_name_to_tag_codes(
    name: str, canonical_tag_codes: set[str] | None = None
) -> tuple[str, ...]:
    """Map a dish display name to preference/style tags only.

    This intentionally does not set dietary or ingredient safety flags.
    """
    lowered = name.lower()
    tags: set[str] = set()

    curated_patterns = {
        "burrito": {"mexican", "wrap", "rice", "saucy", "customisable", "filling_meal"},
        "taco": {"mexican", "wrap", "customisable", "savory"},
        "nacho": {"mexican", "cheesy", "crispy", "customisable", "savory"},
        "sushi": {"japanese", "sushi", "rice", "cold_food", "fresh", "easy_to_eat"},
        "teriyaki": {"japanese", "rice", "bowl", "saucy", "hot_food"},
        "katsu": {"japanese", "rice", "bowl", "crispy", "hot_food"},
        "poke": {"asian", "bowl", "rice", "fresh", "cold_food"},
        "pasta": {"italian", "pasta", "hot_food", "filling_meal"},
        "spaghetti": {"italian", "pasta", "hot_food", "saucy", "filling_meal"},
        "lasagne": {"italian", "pasta", "cheesy", "hot_food", "filling_meal"},
        "pizza": {"italian", "pizza", "cheesy", "familiar_food", "easy_to_eat"},
        "curry": {"curry", "rice", "saucy", "hot_food", "filling_meal"},
        "noodle": {"asian", "noodle", "saucy", "hot_food"},
        "laksa": {"asian", "noodle", "curry", "saucy", "hot_food"},
        "burger": {"american", "burger", "familiar_food", "filling_meal", "easy_to_eat"},
        "slider": {"american", "burger", "familiar_food", "easy_to_eat"},
        "salad": {"salad", "fresh", "light_meal"},
        "sandwich": {"sandwich", "familiar_food", "cold_food", "easy_to_eat"},
        "roll": {"sandwich", "familiar_food", "easy_to_eat"},
        "wrap": {"wrap", "fresh", "easy_to_eat", "customisable"},
        "bowl": {"bowl", "customisable"},
        "falafel": {"middle_eastern", "wrap", "vegetarian_style", "fresh", "savory"},
        "hummus": {"middle_eastern", "fresh", "vegetarian_style"},
    }
    for pattern, pattern_tags in curated_patterns.items():
        if pattern in lowered:
            tags.update(pattern_tags)

    if any(word in lowered for word in ("chicken", "karaage", "teriyaki")):
        tags.add("chicken_style")
    if any(word in lowered for word in ("beef", "meatball", "bolognese", "steak")):
        tags.add("beef_style")
    if any(word in lowered for word in ("fish", "salmon", "tuna", "prawn", "seafood")):
        tags.add("seafood_style")
    if any(word in lowered for word in ("vegetarian", "veggie", "veg ", "falafel", "tofu")):
        tags.add("vegetarian_style")
    if any(word in lowered for word in ("vegan", "plant")):
        tags.update({"vegetarian_style", "plant_based"})
    if "egg" in lowered:
        tags.add("egg_style")

    if any(word in lowered for word in ("spicy", "chilli", "chili", "jalapeno")):
        tags.add("spicy")
    if any(word in lowered for word in ("mild", "plain")):
        tags.add("mild")
    if any(word in lowered for word in ("cream", "creamy", "alfredo")):
        tags.add("creamy")
    if any(word in lowered for word in ("cheese", "cheesy", "parmigiana")):
        tags.add("cheesy")
    if any(word in lowered for word in ("crispy", "crunch", "fried")):
        tags.add("crispy")
    if any(word in lowered for word in ("cookie", "brownie", "cake", "dessert")):
        tags.update({"dessert", "sweet", "snack"})

    if not tags:
        tags.update({"modern_australian", "familiar_food", "easy_to_eat", "savory"})
    if "hot_food" not in tags and "cold_food" not in tags:
        tags.add(
            "hot_food" if any(t in tags for t in ("pasta", "curry", "noodle", "burger")) else "mild"
        )
    if "sweet" not in tags:
        tags.add("savory")

    validate_tag_codes(tags, canonical_tag_codes)
    return tuple(sorted(tags))


def build_dish_variant_tag_rows(
    variants: list[dict[str, Any]],
    canonical_tag_codes: set[str] | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for variant in sorted(variants, key=lambda row: (display_variant_name(row), row["id"])):
        variant_name = display_variant_name(variant)
        for tag_code in dish_name_to_tag_codes(variant_name, canonical_tag_codes):
            rows.append(
                {
                    "id": stable_uuid(f"dish_variant_tag:{variant['id']}:{tag_code}"),
                    "dish_variant_id": variant["id"],
                    "tag_code": tag_code,
                    "tag_source": "manual",
                    "confidence": 1.0,
                    "notes": DEMO_SEED_NOTES,
                }
            )
    return rows


def assign_student_archetype(student: dict[str, Any]) -> StudentArchetype:
    key = f"{student.get('id')}:{student.get('full_name', '')}"
    return ARCHETYPES[stable_int(key) % len(ARCHETYPES)]


def should_seed_student(student: dict[str, Any]) -> bool:
    if student.get("opted_out"):
        return False
    key = f"seed-student:{student.get('id')}:{student.get('full_name', '')}"
    return stable_int(key) % 100 < 90


def signal_rows_for_student(
    student: dict[str, Any],
    week_start: date,
    canonical_tag_codes: set[str] | None = None,
) -> list[dict[str, Any]]:
    archetype = assign_student_archetype(student)
    tags = set(archetype.positive_tags + archetype.negative_tags)
    validate_tag_codes(tags, canonical_tag_codes)

    observed_at = datetime.combine(
        week_start - timedelta(days=stable_int(f"observed:{student['id']}") % 42 + 7),
        datetime.min.time(),
        tzinfo=UTC,
    ).replace(hour=8, minute=30)
    rows: list[dict[str, Any]] = []
    for tag_code in archetype.positive_tags[:5]:
        rows.append(
            {
                "id": stable_uuid(f"student_preference_signal:{student['id']}:{tag_code}"),
                "student_id": student["id"],
                "tag_code": tag_code,
                "affinity_score": stable_float(
                    f"affinity:+:{student['id']}:{tag_code}", 0.35, 0.86
                ),
                "confidence": stable_float(f"confidence:+:{student['id']}:{tag_code}", 0.42, 0.82),
                "feedback_count": 1 + stable_int(f"count:+:{student['id']}:{tag_code}") % 6,
                "last_observed_at": observed_at.isoformat(),
            }
        )
    for tag_code in archetype.negative_tags[:3]:
        rows.append(
            {
                "id": stable_uuid(f"student_preference_signal:{student['id']}:{tag_code}"),
                "student_id": student["id"],
                "tag_code": tag_code,
                "affinity_score": stable_float(
                    f"affinity:-:{student['id']}:{tag_code}", -0.78, -0.22
                ),
                "confidence": stable_float(f"confidence:-:{student['id']}:{tag_code}", 0.35, 0.74),
                "feedback_count": 1 + stable_int(f"count:-:{student['id']}:{tag_code}") % 4,
                "last_observed_at": observed_at.isoformat(),
            }
        )
    return rows


def _variant_by_tag(
    variants: list[dict[str, Any]],
    dish_tag_rows: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    variants_by_id = {variant["id"]: variant for variant in variants}
    by_tag: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in dish_tag_rows:
        variant = variants_by_id.get(row["dish_variant_id"])
        if variant:
            by_tag[row["tag_code"]].append(variant)
    for tag_code, tagged_variants in by_tag.items():
        by_tag[tag_code] = sorted(
            tagged_variants,
            key=lambda row: (display_variant_name(row), row["id"]),
        )
    return by_tag


def _pick_variant_for_tags(
    tag_codes: tuple[str, ...],
    by_tag: dict[str, list[dict[str, Any]]],
    key: str,
) -> dict[str, Any] | None:
    candidates: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for tag_code in tag_codes:
        for variant in by_tag.get(tag_code, []):
            if variant["id"] not in seen_ids:
                seen_ids.add(variant["id"])
                candidates.append(variant)
    if not candidates:
        return None
    return candidates[stable_int(key) % len(candidates)]


def build_student_history_rows(
    students: list[dict[str, Any]],
    enrolments_by_student: dict[str, list[str]],
    sessions_by_id: dict[str, dict[str, Any]],
    variants: list[dict[str, Any]],
    dish_tag_rows: list[dict[str, Any]],
    week_start: date,
    canonical_tag_codes: set[str] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str], list[str]]:
    seeded_students = [
        student
        for student in sorted(students, key=lambda row: (row.get("full_name", ""), row["id"]))
        if should_seed_student(student)
    ]
    variants_by_tag = _variant_by_tag(variants, dish_tag_rows)
    feedback_rows: list[dict[str, Any]] = []
    signal_rows: list[dict[str, Any]] = []
    signal_tag_codes: set[str] = set()

    for student in seeded_students:
        archetype = assign_student_archetype(student)
        signals = signal_rows_for_student(student, week_start, canonical_tag_codes)
        signal_rows.extend(signals)
        signal_tag_codes.update(row["tag_code"] for row in signals)

        session_ids = sorted(enrolments_by_student.get(student["id"], []))
        session_id = (
            session_ids[stable_int(f"session:{student['id']}") % len(session_ids)]
            if session_ids
            else None
        )
        positive_variant = _pick_variant_for_tags(
            archetype.positive_tags,
            variants_by_tag,
            f"positive-variant:{student['id']}",
        )
        negative_variant = _pick_variant_for_tags(
            archetype.negative_tags,
            variants_by_tag,
            f"negative-variant:{student['id']}",
        )
        days_back = 7 + stable_int(f"feedback-date:{student['id']}") % 56
        created_at = datetime.combine(
            week_start - timedelta(days=days_back),
            datetime.min.time(),
            tzinfo=UTC,
        ).replace(hour=7 + stable_int(f"feedback-hour:{student['id']}") % 8)

        positive_rating = 4 + stable_int(f"positive-rating:{student['id']}") % 2
        feedback_rows.append(
            {
                "id": stable_uuid(f"student_meal_feedback:{student['id']}:positive"),
                "student_id": student["id"],
                "session_id": session_id,
                "dish_variant_id": positive_variant["id"] if positive_variant else None,
                "rating": positive_rating,
                "liked": True,
                "free_text": archetype.liked_phrase,
                "requested_food": archetype.request_phrase,
                "source": "demo_seed",
                "created_at": created_at.isoformat(),
                "metadata": demo_metadata(
                    archetype=archetype.code,
                    sentiment="positive",
                    linked_session_date=sessions_by_id.get(session_id, {}).get("session_date")
                    if session_id
                    else None,
                ),
            }
        )
        if stable_int(f"negative-feedback:{student['id']}") % 100 < 35:
            feedback_rows.append(
                {
                    "id": stable_uuid(f"student_meal_feedback:{student['id']}:negative"),
                    "student_id": student["id"],
                    "session_id": session_id,
                    "dish_variant_id": negative_variant["id"] if negative_variant else None,
                    "rating": 2,
                    "liked": False,
                    "free_text": archetype.disliked_phrase,
                    "requested_food": None,
                    "source": "demo_seed",
                    "created_at": (created_at - timedelta(days=14)).isoformat(),
                    "metadata": demo_metadata(archetype=archetype.code, sentiment="negative"),
                }
            )

    return (
        feedback_rows,
        signal_rows,
        [student["id"] for student in seeded_students],
        sorted(signal_tag_codes),
    )


def build_fit_debt_rows(
    seeded_student_ids: list[str],
    week_start: date,
) -> tuple[list[dict[str, Any]], list[str]]:
    selected = sorted(
        seeded_student_ids, key=lambda student_id: stable_int(f"fit-debt:{student_id}")
    )[:12]
    rows: list[dict[str, Any]] = []
    for index, student_id in enumerate(selected):
        if index < 4:
            score = stable_float(f"fit-debt-high:{student_id}", 2.05, 2.8)
            reason = (
                "Repeated second-choice allocation after dietary-safe options narrowed the "
                "offer set."
            )
            decayed = stable_float(f"fit-debt-high-decay:{student_id}", 1.1, 1.8)
        elif index < 8:
            score = stable_float(f"fit-debt-medium:{student_id}", 1.0, 1.65)
            reason = "Minority taste pattern was not well represented in the previous demo history."
            decayed = stable_float(f"fit-debt-medium-decay:{student_id}", 0.5, 0.95)
        else:
            score = stable_float(f"fit-debt-low:{student_id}", 0.2, 0.75)
            reason = "Small accumulated preference mismatch carried into this service week."
            decayed = stable_float(f"fit-debt-low-decay:{student_id}", 0.05, 0.3)
        rows.append(
            {
                "id": stable_uuid(f"student_fit_debt:{week_start.isoformat()}:{student_id}"),
                "student_id": student_id,
                "service_week_start": week_start.isoformat(),
                "fit_debt_score": score,
                "reason": reason,
                "decayed_from_previous": decayed,
            }
        )
    return rows, selected


def build_quality_rows(
    sessions: list[dict[str, Any]],
    caterers: list[dict[str, Any]],
    week_start: date,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    sorted_sessions = sorted(sessions, key=lambda row: (row.get("session_date", ""), row["id"]))
    if not sorted_sessions:
        return [], []
    sessions_by_caterer: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for session in sorted_sessions:
        sessions_by_caterer[session["caterer_id"]].append(session)

    scenarios = [
        (
            "late_delivery_pattern",
            "review",
            "Recent deliveries have arrived after the dinner window twice in three sessions.",
            "late",
            3,
            "moderate",
            ["late_delivery"],
        ),
        (
            "missing_items",
            "serious",
            "One session was short several labelled meals and needed manager redistribution.",
            "missing_items",
            2,
            "low",
            ["missing_items", "quantity_shortfall"],
        ),
        (
            "food_quality",
            "review",
            "Managers noted a quality dip: hot meals arrived lukewarm and less appealing.",
            "on_time",
            2,
            "high",
            ["quality_decline", "temperature"],
        ),
        (
            "student_dislike",
            "review",
            "Several students left the same option untouched across repeat sessions.",
            "on_time",
            2,
            "high",
            ["student_dislike", "leftovers"],
        ),
        (
            "positive_feedback",
            "info",
            "Students and managers responded well to labelled, easy-to-distribute meals.",
            "on_time",
            5,
            "none",
            ["positive_feedback"],
        ),
    ]

    feedback_rows: list[dict[str, Any]] = []
    event_rows: list[dict[str, Any]] = []
    caterer_cycle = sorted(caterers, key=lambda row: (row.get("name", ""), row["id"])) or [
        {"id": sorted_sessions[0]["caterer_id"], "name": "Caterer"}
    ]
    for index, scenario in enumerate(scenarios):
        (
            event_type,
            severity,
            summary,
            delivery_status,
            quality_rating,
            leftover_level,
            issue_tags,
        ) = scenario
        caterer = caterer_cycle[index % len(caterer_cycle)]
        caterer_sessions = sessions_by_caterer.get(caterer["id"], sorted_sessions)
        session = caterer_sessions[index % len(caterer_sessions)]
        created_at = datetime.combine(
            week_start - timedelta(days=21 - index),
            datetime.min.time(),
            tzinfo=UTC,
        ).replace(hour=6 + index)
        feedback_rows.append(
            {
                "id": stable_uuid(f"session_catering_feedback:{session['id']}:{event_type}"),
                "session_id": session["id"],
                "caterer_id": caterer["id"],
                "delivery_status": delivery_status,
                "food_quality_rating": quality_rating,
                "leftover_level": leftover_level,
                "issue_tags": issue_tags,
                "manager_notes": summary,
                "source": "demo_seed",
                "created_at": created_at.isoformat(),
                "metadata": demo_metadata(event_type=event_type),
            }
        )
        event_rows.append(
            {
                "id": stable_uuid(
                    f"caterer_quality_event:{caterer['id']}:{session['id']}:{event_type}"
                ),
                "caterer_id": caterer["id"],
                "session_id": session["id"],
                "event_type": event_type,
                "severity": severity,
                "summary": summary,
                "source": "demo_seed",
                "created_at": created_at.isoformat(),
                "metadata": demo_metadata(
                    demo_category="quality_signal",
                    source_session_feedback_id=feedback_rows[-1]["id"],
                ),
            }
        )
    return feedback_rows, event_rows


def build_reply_and_autopilot_rows(
    communications: list[dict[str, Any]],
    caterers: list[dict[str, Any]],
    sessions: list[dict[str, Any]],
    students: list[dict[str, Any]],
    variants: list[dict[str, Any]],
    week_start: date,
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[tuple[str, str]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    communication_cycle = sorted(
        communications,
        key=lambda row: (row.get("created_at", ""), row.get("subject", ""), row["id"]),
    )
    caterer_cycle = sorted(caterers, key=lambda row: (row.get("name", ""), row["id"]))

    scenarios = [
        {
            "key": "clean_confirmation",
            "subject": "Re: Padea catering order confirmed",
            "raw_body": "Confirmed for Friday. We will deliver the labelled meals by 5:15pm.",
            "parsed_intent": "confirmation",
            "handled_status": "auto_handled",
            "confidence": 0.964,
            "handling_summary": "Clean confirmation; no operator action required.",
            "needs_human_review": False,
            "parsed_output": {
                "intent": "confirmation",
                "confidence": 0.964,
                "changes_requested": [],
                "safety_relevance": "none",
                "recommended_action": "mark_confirmed",
            },
        },
        {
            "key": "item_unavailable_handled",
            "subject": "Re: one item unavailable",
            "raw_body": (
                "The chicken burrito filling is unavailable. We can supply the reviewed chicken "
                "rice bowl instead at the same quantity and price."
            ),
            "parsed_intent": "item_unavailable",
            "handled_status": "auto_handled",
            "confidence": 0.882,
            "handling_summary": "Demo scenario: equivalent reviewed option could be auto-handled.",
            "needs_human_review": False,
            "parsed_output": {
                "intent": "item_unavailable",
                "confidence": 0.882,
                "changes_requested": [
                    {
                        "from": "chicken burrito",
                        "to": "reviewed chicken rice bowl",
                        "quantity_change": 0,
                        "price_change": 0,
                    }
                ],
                "safety_relevance": "low",
                "recommended_action": "accept_equivalent_reviewed_substitution",
            },
        },
        {
            "key": "ambiguous_safety_refused",
            "subject": "Re: menu replacement question",
            "raw_body": (
                "We may swap in the mixed seafood noodles if the vegetarian trays are short. "
                "It should be fine for most students, please confirm if that is okay."
            ),
            "parsed_intent": "other",
            "handled_status": "escalated",
            "confidence": 0.538,
            "handling_summary": (
                "Refused for auto-handling because the reply is safety-relevant and ambiguous."
            ),
            "needs_human_review": True,
            "parsed_output": {
                "intent": "other",
                "confidence": 0.538,
                "changes_requested": [{"from": "vegetarian trays", "to": "mixed seafood noodles"}],
                "safety_relevance": "high",
                "refusal_reason": (
                    "potential dietary/allergen impact and unclear affected quantities"
                ),
                "recommended_action": "human_review_required",
            },
        },
    ]

    reply_rows: list[dict[str, Any]] = []
    ai_rows: list[dict[str, Any]] = []
    reply_ai_links: list[tuple[str, str]] = []
    received_base = datetime.combine(week_start, datetime.min.time(), tzinfo=UTC).replace(hour=3)
    for index, scenario in enumerate(scenarios):
        communication = communication_cycle[index] if index < len(communication_cycle) else None
        caterer = caterer_cycle[index % len(caterer_cycle)] if caterer_cycle else None
        reply_id = stable_uuid(f"caterer_reply_intake:{week_start.isoformat()}:{scenario['key']}")
        ai_id = stable_uuid(f"ai_interpretation:caterer_reply:{reply_id}")
        raw_input = scenario["raw_body"]
        parsed_output = scenario["parsed_output"]
        reply_rows.append(
            {
                "id": reply_id,
                "communication_id": communication["id"] if communication else None,
                "order_run_id": communication.get("order_run_id") if communication else None,
                "caterer_id": communication.get("caterer_id")
                if communication
                else (caterer or {}).get("id"),
                "provider": "demo_mailbox",
                "provider_thread_id": f"demo-thread-{index + 1}",
                "provider_message_id": f"demo-message-{index + 1}",
                "from_email": f"demo-caterer-{index + 1}@example.invalid",
                "subject": scenario["subject"],
                "raw_body": raw_input,
                "received_at": (received_base + timedelta(hours=index)).isoformat(),
                "parsed_intent": scenario["parsed_intent"],
                "handled_status": scenario["handled_status"],
                "confidence": scenario["confidence"],
                "handled_at": (received_base + timedelta(hours=index, minutes=12)).isoformat(),
                "handling_summary": scenario["handling_summary"],
                "metadata": demo_metadata(scenario=scenario["key"]),
            }
        )
        raw_output = json.dumps(
            {
                "type": "claude_demo_reply_parse",
                "schema_version": "caterer_reply_intake_v1",
                "result": parsed_output,
            },
            sort_keys=True,
        )
        ai_rows.append(
            {
                "id": ai_id,
                "purpose": "caterer_reply",
                "provider": DEMO_SEED_PROVIDER,
                "model": "claude-sonnet-demo-shape",
                "prompt_version": "demo_seed_reply_v1",
                "schema_version": "caterer_reply_intake_v1",
                "input_hash": stable_hash_text(raw_input),
                "raw_input": raw_input,
                "raw_output": raw_output,
                "parsed_output": parsed_output,
                "confidence": scenario["confidence"],
                "needs_human_review": scenario["needs_human_review"],
                "caterer_reply_id": reply_id,
                "metadata": demo_metadata(scenario=scenario["key"]),
            }
        )
        reply_ai_links.append((reply_id, ai_id))

    run_id = stable_uuid(f"autopilot_run:{week_start.isoformat()}:stage3-demo")
    exceptions = _build_autopilot_exception_rows(
        run_id=run_id,
        week_start=week_start,
        reply_rows=reply_rows,
        caterers=caterers,
        sessions=sessions,
        students=students,
        variants=variants,
    )
    autopilot_runs = [
        {
            "id": run_id,
            "service_week_start": week_start.isoformat(),
            "idempotency_key": f"demo-seed:{week_start.isoformat()}:stage3",
            "status": "human_review_required",
            "trigger_source": "manual_demo",
            "started_at": received_base.isoformat(),
            "completed_at": (received_base + timedelta(hours=2)).isoformat(),
            "summary": (
                "Demo autopilot narrative: routine preparation completed, with human review "
                "held for one ambiguous caterer reply and representative quality/meal-fit signals."
            ),
            "generated_order_run_id": communication_cycle[0].get("order_run_id")
            if communication_cycle
            else None,
            "exception_count": len(exceptions),
            "emails_prepared_count": len(
                {row.get("communication_id") for row in reply_rows if row.get("communication_id")}
            ),
            "emails_sent_count": 0,
            "ai_interpretation_count": len(ai_rows),
            "metadata": demo_metadata(
                narrative_steps=[
                    "validation gates reused existing readiness facts",
                    "preference history available for meal-fit scoring",
                    "caterer replies parsed with simulated Claude-shaped provenance",
                    "ambiguous safety-relevant substitution escalated",
                ]
            ),
        }
    ]
    return reply_rows, ai_rows, reply_ai_links, autopilot_runs, exceptions


def _build_autopilot_exception_rows(
    *,
    run_id: str,
    week_start: date,
    reply_rows: list[dict[str, Any]],
    caterers: list[dict[str, Any]],
    sessions: list[dict[str, Any]],
    students: list[dict[str, Any]],
    variants: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    sorted_caterers = sorted(caterers, key=lambda row: (row.get("name", ""), row["id"]))
    sorted_sessions = sorted(sessions, key=lambda row: (row.get("session_date", ""), row["id"]))
    sorted_students = sorted(
        [student for student in students if not student.get("opted_out")],
        key=lambda row: (row.get("full_name", ""), row["id"]),
    )
    sorted_variants = sorted(variants, key=lambda row: (display_variant_name(row), row["id"]))
    ambiguous_reply = next(
        (
            row
            for row in reply_rows
            if row["metadata"].get("scenario") == "ambiguous_safety_refused"
        ),
        None,
    )
    scenario_rows = [
        {
            "key": "ambiguous_safety_reply",
            "severity": "blocked",
            "category": "caterer_reply",
            "title": "Ambiguous caterer substitution needs review",
            "detail": (
                "A caterer proposed replacing vegetarian trays with mixed seafood noodles. "
                "The substitution is dietary/safety relevant and cannot be auto-accepted."
            ),
            "recommended_action": (
                "Call the caterer and confirm a reviewed vegetarian-safe replacement."
            ),
            "ai_confidence": ambiguous_reply.get("confidence") if ambiguous_reply else 0.538,
            "caterer_id": ambiguous_reply.get("caterer_id") if ambiguous_reply else None,
        },
        {
            "key": "quality_decline",
            "severity": "review",
            "category": "quality",
            "title": "Caterer quality trend should affect next offer set",
            "detail": "Demo quality events show lateness and lukewarm meals for one caterer.",
            "recommended_action": (
                "Review caterer quality before allowing autopilot to select offers."
            ),
            "ai_confidence": None,
            "caterer_id": sorted_caterers[0]["id"] if sorted_caterers else None,
        },
        {
            "key": "meal_fit_debt",
            "severity": "review",
            "category": "meal_fit",
            "title": "High fit debt student needs better option coverage",
            "detail": "A student has accumulated repeated second-choice meal assignments.",
            "recommended_action": (
                "Prefer an offer set with at least one high-affinity safe option."
            ),
            "ai_confidence": None,
            "student_id": sorted_students[0]["id"] if sorted_students else None,
            "dish_variant_id": sorted_variants[0]["id"] if sorted_variants else None,
        },
    ]
    rows: list[dict[str, Any]] = []
    for index, scenario in enumerate(scenario_rows):
        rows.append(
            {
                "id": stable_uuid(
                    f"autopilot_exception:{week_start.isoformat()}:{scenario['key']}"
                ),
                "autopilot_run_id": run_id,
                "service_week_start": week_start.isoformat(),
                "severity": scenario["severity"],
                "category": scenario["category"],
                "title": scenario["title"],
                "detail": scenario["detail"],
                "recommended_action": scenario["recommended_action"],
                "status": "open",
                "ai_confidence": scenario["ai_confidence"],
                "student_id": scenario.get("student_id"),
                "session_id": sorted_sessions[index % len(sorted_sessions)]["id"]
                if sorted_sessions
                else None,
                "caterer_id": scenario.get("caterer_id"),
                "order_run_id": None,
                "dish_variant_id": scenario.get("dish_variant_id"),
                "metadata": demo_metadata(scenario=scenario["key"]),
            }
        )
    return rows


def build_demo_seed_plan(client: Client, week_start: date) -> DemoSeedPlan:
    canonical_tags = {
        row["code"]
        for row in _select(client, "preference_tags", "code, is_active")
        if row.get("is_active", True)
    }
    validate_tag_codes(CANONICAL_TAG_CODES & canonical_tags, canonical_tags)

    dishes = {row["id"]: row for row in _select(client, "dishes", "id, caterer_id, name")}
    variants = []
    for row in _select(client, "dish_variants", "id, dish_id, name, is_available"):
        dish = dishes.get(row["dish_id"])
        if not dish:
            continue
        variants.append({**row, "dish_name": dish["name"], "caterer_id": dish["caterer_id"]})

    students = _select(client, "students", "id, full_name, opted_out")
    sessions = _select(client, "sessions", "id, caterer_id, session_date")
    sessions_by_id = {row["id"]: row for row in sessions}
    enrolments_by_student: dict[str, list[str]] = defaultdict(list)
    for row in _select(client, "session_enrolments", "student_id, session_id"):
        enrolments_by_student[row["student_id"]].append(row["session_id"])
    caterers = _select(client, "caterers", "id, name")
    communications = _select(
        client,
        "order_communications",
        "id, order_run_id, caterer_id, subject, created_at",
    )

    dish_tag_rows = build_dish_variant_tag_rows(variants, canonical_tags)
    feedback_rows, signal_rows, seeded_student_ids, signal_tag_codes = build_student_history_rows(
        students=students,
        enrolments_by_student=enrolments_by_student,
        sessions_by_id=sessions_by_id,
        variants=variants,
        dish_tag_rows=dish_tag_rows,
        week_start=week_start,
        canonical_tag_codes=canonical_tags,
    )
    fit_debt_rows, fit_debt_student_ids = build_fit_debt_rows(seeded_student_ids, week_start)
    session_feedback_rows, quality_event_rows = build_quality_rows(sessions, caterers, week_start)
    reply_rows, ai_rows, reply_ai_links, autopilot_runs, autopilot_exceptions = (
        build_reply_and_autopilot_rows(
            communications=communications,
            caterers=caterers,
            sessions=sessions,
            students=students,
            variants=variants,
            week_start=week_start,
        )
    )

    plan = DemoSeedPlan(
        week_start=week_start,
        dish_variant_tags=dish_tag_rows,
        student_meal_feedback=feedback_rows,
        student_preference_signals=signal_rows,
        student_fit_debt=fit_debt_rows,
        session_catering_feedback=session_feedback_rows,
        caterer_quality_events=quality_event_rows,
        caterer_reply_intake=reply_rows,
        ai_interpretations=ai_rows,
        reply_ai_links=reply_ai_links,
        autopilot_runs=autopilot_runs,
        autopilot_exceptions=autopilot_exceptions,
        seeded_student_ids=seeded_student_ids,
        seeded_signal_tag_codes=signal_tag_codes,
        fit_debt_student_ids=fit_debt_student_ids,
        examples={
            "dish_variant_tags": dish_tag_rows[:3],
            "student_meal_feedback": feedback_rows[:2],
            "autopilot_exceptions": autopilot_exceptions[:1],
        },
    )
    return plan


def reset_filters_for_plan(plan: DemoSeedPlan) -> list[ResetFilter]:
    return [
        ResetFilter("student_meal_feedback", "source", "eq", "demo_seed"),
        ResetFilter("session_catering_feedback", "source", "eq", "demo_seed"),
        ResetFilter("caterer_quality_events", "source", "eq", "demo_seed"),
        ResetFilter("dish_variant_tags", "notes", "eq", DEMO_SEED_NOTES),
        ResetFilter("ai_interpretations", "metadata", "contains", {"demo_seed": True}),
        ResetFilter("caterer_reply_intake", "metadata", "contains", {"demo_seed": True}),
        ResetFilter("autopilot_exceptions", "metadata", "contains", {"demo_seed": True}),
        ResetFilter("autopilot_runs", "metadata", "contains", {"demo_seed": True}),
        ResetFilter("student_fit_debt", "service_week_start", "eq", plan.week_start.isoformat()),
        ResetFilter("student_fit_debt", "student_id", "in", plan.fit_debt_student_ids),
        ResetFilter("student_preference_signals", "student_id", "in", plan.seeded_student_ids),
        ResetFilter("student_preference_signals", "tag_code", "in", plan.seeded_signal_tag_codes),
    ]


def reset_demo_seed_rows(client: Client, plan: DemoSeedPlan) -> None:
    client.table("student_meal_feedback").delete().eq("source", "demo_seed").execute()
    client.table("session_catering_feedback").delete().eq("source", "demo_seed").execute()
    client.table("caterer_quality_events").delete().eq("source", "demo_seed").execute()
    client.table("dish_variant_tags").delete().eq("notes", DEMO_SEED_NOTES).execute()

    client.table("ai_interpretations").delete().contains("metadata", {"demo_seed": True}).execute()
    client.table("caterer_reply_intake").delete().contains(
        "metadata", {"demo_seed": True}
    ).execute()
    client.table("autopilot_exceptions").delete().contains(
        "metadata", {"demo_seed": True}
    ).execute()
    client.table("autopilot_runs").delete().contains("metadata", {"demo_seed": True}).execute()

    if plan.fit_debt_student_ids:
        client.table("student_fit_debt").delete().eq(
            "service_week_start",
            plan.week_start.isoformat(),
        ).in_("student_id", plan.fit_debt_student_ids).execute()
    if plan.seeded_student_ids and plan.seeded_signal_tag_codes:
        client.table("student_preference_signals").delete().in_(
            "student_id",
            plan.seeded_student_ids,
        ).in_("tag_code", plan.seeded_signal_tag_codes).execute()


def apply_demo_seed_plan(client: Client, plan: DemoSeedPlan, *, reset: bool = False) -> None:
    if reset:
        reset_demo_seed_rows(client, plan)

    _upsert(
        client, "dish_variant_tags", plan.dish_variant_tags, on_conflict="dish_variant_id,tag_code"
    )
    _upsert(client, "student_meal_feedback", plan.student_meal_feedback, on_conflict="id")
    _upsert(
        client,
        "student_preference_signals",
        plan.student_preference_signals,
        on_conflict="student_id,tag_code",
    )
    _upsert(
        client,
        "student_fit_debt",
        plan.student_fit_debt,
        on_conflict="student_id,service_week_start",
    )
    _upsert(client, "session_catering_feedback", plan.session_catering_feedback, on_conflict="id")
    _upsert(client, "caterer_quality_events", plan.caterer_quality_events, on_conflict="id")
    _upsert(client, "autopilot_runs", plan.autopilot_runs, on_conflict="id")
    _upsert(client, "autopilot_exceptions", plan.autopilot_exceptions, on_conflict="id")
    _upsert(client, "caterer_reply_intake", plan.caterer_reply_intake, on_conflict="id")
    _upsert(client, "ai_interpretations", plan.ai_interpretations, on_conflict="id")
    for reply_id, ai_id in plan.reply_ai_links:
        client.table("caterer_reply_intake").update({"ai_interpretation_id": ai_id}).eq(
            "id", reply_id
        ).execute()


def describe_plan(plan: DemoSeedPlan) -> str:
    lines = [
        "=" * 64,
        "Final demo seed data plan",
        "=" * 64,
        f"service_week_start       : {plan.week_start.isoformat()}",
        f"seeded_students          : {len(plan.seeded_student_ids)}",
    ]
    for table, count in plan.counts.items():
        lines.append(f"{table:25}: {count}")
    lines.append("")
    lines.append("Example rows:")
    for name, rows in plan.examples.items():
        lines.append(f"- {name}:")
        for row in rows:
            lines.append(f"  {json.dumps(row, sort_keys=True, default=str)}")
    return "\n".join(lines)


def _select(client: Client, table: str, columns: str = "*") -> list[dict[str, Any]]:
    return client.table(table).select(columns).execute().data


def _upsert(
    client: Client,
    table: str,
    rows: list[dict[str, Any]],
    *,
    on_conflict: str,
    chunk_size: int = 500,
) -> None:
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        if chunk:
            client.table(table).upsert(chunk, on_conflict=on_conflict).execute()
