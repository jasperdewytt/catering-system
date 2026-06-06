"""Preference-aware meal-fit planning and persistence."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from itertools import combinations
from math import comb
from typing import Any

from padea_catering.ordering.generator import (
    AllocationDraft,
    IssueDraft,
    OrderLineDraft,
    OrderPlan,
)
from padea_catering.ordering.rules import DishOption, dish_failure_reasons, is_safe_dish
from supabase import Client

from .scoring import (
    DEFAULT_VERSION,
    CandidateContext,
    DishTag,
    MealFitScoringConfig,
    PreferenceSignal,
    ScoreBreakdown,
    StudentPreferenceProfile,
    clamp,
    config_from_row,
    score_candidate,
)

ALGORITHM_VERSION = "meal-fit-v1"
MAX_ENUMERATED_SUBSETS = 100_000


@dataclass(frozen=True)
class VariantCandidate:
    option: DishOption
    caterer_id: str
    dish_id: str
    display_name: str
    tags: tuple[DishTag, ...]
    population_prior: float = 0.0


@dataclass(frozen=True)
class StudentDemand:
    session_id: str
    student_id: str
    caterer_id: str
    dietary_tag_codes: tuple[str, ...]


@dataclass(frozen=True)
class AllocationExplanationDraft:
    session_id: str
    student_id: str
    dish_variant_id: str
    scoring_version: str
    chosen_score: float
    top_feasible_variant_id: str | None
    top_feasible_score: float | None
    constrained_by: list[str]
    positive_factors: list[dict[str, Any]]
    negative_factors: list[dict[str, Any]]
    fit_debt_applied: float
    novelty_applied: float
    explanation: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class SelectedOfferSet:
    caterer_id: str
    method: str
    menu_item_count: int
    minimum_meals: int
    projected_demand: int
    forced_waste: int
    score: float
    low_fit_count: int
    recent_repetition: float
    novelty_coverage: float
    moq_warning_count: int
    variant_ids: tuple[str, ...]
    accepted_warnings: tuple[str, ...]


@dataclass(frozen=True)
class MealFitOrderPlan(OrderPlan):
    selected_offer_sets: list[SelectedOfferSet]
    explanations: list[AllocationExplanationDraft]
    scoring_config: MealFitScoringConfig


@dataclass(frozen=True)
class _LoadedData:
    service_week_start: date
    service_week_end: date
    scoring_config: MealFitScoringConfig
    schools: dict[str, dict[str, Any]]
    caterers: dict[str, dict[str, Any]]
    sessions: list[dict[str, Any]]
    sessions_by_id: dict[str, dict[str, Any]]
    students: dict[str, dict[str, Any]]
    enrolments_by_session: dict[str, list[dict[str, Any]]]
    tags_by_student: dict[str, set[str]]
    pending_warning_students: set[str]
    excluded_years_by_session: dict[str, set[int]]
    absent_pairs: set[tuple[str, str]]
    candidates_by_caterer: dict[str, list[VariantCandidate]]
    minimums_by_caterer: dict[str, list[dict[str, int]]]
    profiles_by_student: dict[str, StudentPreferenceProfile]
    caterer_quality_penalties: dict[str, float]
    leftover_penalties: dict[str, float]


def _select(client: Client, table: str, columns: str = "*") -> list[dict[str, Any]]:
    return client.table(table).select(columns).execute().data


def _week_end(week_start: date) -> date:
    return week_start + timedelta(days=6)


def _in_week(session: dict[str, Any], week_start: date, week_end: date) -> bool:
    session_date = date.fromisoformat(str(session["session_date"]))
    return week_start <= session_date <= week_end


def _as_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    return float(value)


def _dish_option(row: dict[str, Any]) -> DishOption:
    return DishOption(
        id=row["id"],
        dish_id=row["dish_id"],
        name=row["display_name"],
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


def build_preference_aware_order_plan(
    client: Client,
    service_week_start: date,
) -> MealFitOrderPlan:
    """Build a preference-aware order plan without writing to the database."""
    data = _load_data(client, service_week_start)
    demand_by_caterer, skipped_allocations, pre_selection_issues = _build_demand(data)

    selected_by_caterer: dict[str, SelectedOfferSet] = {}
    selection_issues: list[IssueDraft] = []
    for caterer_id, demand in sorted(demand_by_caterer.items()):
        selected = select_offer_set_for_caterer(
            caterer_id=caterer_id,
            candidates=data.candidates_by_caterer.get(caterer_id, []),
            minimum_tiers=data.minimums_by_caterer.get(caterer_id, []),
            demand=demand,
            profiles_by_student=data.profiles_by_student,
            scoring_config=data.scoring_config,
            caterer_quality_penalty=data.caterer_quality_penalties.get(caterer_id, 0.0),
            leftover_penalty=data.leftover_penalties.get(caterer_id, 0.0),
        )
        if selected is None:
            caterer = data.caterers.get(caterer_id, {})
            candidate_count = len(data.candidates_by_caterer.get(caterer_id, []))
            code = "no_menu_offer" if candidate_count == 0 else "no_safe_dish"
            message = (
                f"{caterer.get('name', caterer_id)} has no reviewed available offer set "
                "that covers all orderable students."
            )
            selection_issues.append(
                IssueDraft(
                    severity="error",
                    code=code,
                    message=message,
                    details={"caterer_id": caterer_id, "candidate_count": candidate_count},
                )
            )
            continue
        selected_by_caterer[caterer_id] = selected

    allocations, order_lines, allocation_issues, explanations = _allocate(data, selected_by_caterer)
    all_allocations = [*skipped_allocations, *allocations]
    all_issues = [*pre_selection_issues, *selection_issues, *allocation_issues]

    selected_sets = list(selected_by_caterer.values())
    snapshot = {
        "algorithm_version": ALGORITHM_VERSION,
        "scoring_version": data.scoring_config.version,
        "service_week_start": data.service_week_start.isoformat(),
        "service_week_end": data.service_week_end.isoformat(),
        "session_ids": [session["id"] for session in data.sessions],
        "selected_offer_sets": [asdict(selected) for selected in selected_sets],
        "scoring_metadata": {
            "weights": asdict(data.scoring_config.weights),
            "decay_config": asdict(data.scoring_config.decay_config),
            "candidate_source": "reviewed_available_dish_variants",
            "max_enumerated_subsets": MAX_ENUMERATED_SUBSETS,
        },
        "source_counts": {
            "sessions": len(data.sessions),
            "students": len(data.students),
            "selected_offer_sets": len(selected_sets),
            "reviewed_candidates": sum(len(items) for items in data.candidates_by_caterer.values()),
            "allocation_explanations": len(explanations),
        },
    }

    has_blockers = any(issue.severity == "error" for issue in all_issues)
    return MealFitOrderPlan(
        service_week_start=data.service_week_start,
        service_week_end=data.service_week_end,
        allocations=all_allocations,
        order_lines=[] if has_blockers else order_lines,
        issues=all_issues,
        input_snapshot=snapshot,
        selected_offer_sets=selected_sets,
        explanations=explanations,
        scoring_config=data.scoring_config,
    )


def generate_preference_aware_order_run(
    client: Client,
    service_week_start: date,
    generated_by: str | None = None,
) -> dict[str, Any]:
    """Build and persist a preference-aware order run."""
    plan = build_preference_aware_order_plan(client, service_week_start)
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

    allocation_rows = [{"order_run_id": run_id, **asdict(row)} for row in plan.allocations]
    inserted_allocations: list[dict[str, Any]] = []
    if allocation_rows:
        inserted_allocations = (
            client.table("order_allocations").insert(allocation_rows).execute().data
        )

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
                    "dish_variant_id": issue.dish_variant_id,
                    "severity": issue.severity,
                    "code": issue.code,
                    "message": issue.message,
                    "details": issue.details or {},
                }
                for issue in plan.issues
            ]
        ).execute()

    if plan.explanations:
        allocation_ids = {
            (row["session_id"], row["student_id"], row.get("dish_variant_id")): row["id"]
            for row in inserted_allocations
            if row.get("status") == "allocated" and row.get("id")
        }
        explanation_rows = []
        for explanation in plan.explanations:
            allocation_id = allocation_ids.get(
                (explanation.session_id, explanation.student_id, explanation.dish_variant_id)
            )
            if allocation_id is None:
                raise RuntimeError(
                    "Supabase did not return inserted order allocation ids needed for "
                    "meal-fit explanations."
                )
            explanation_rows.append(
                {
                    "order_allocation_id": allocation_id,
                    "scoring_version": explanation.scoring_version,
                    "chosen_score": round(explanation.chosen_score, 4),
                    "top_feasible_variant_id": explanation.top_feasible_variant_id,
                    "top_feasible_score": (
                        None
                        if explanation.top_feasible_score is None
                        else round(explanation.top_feasible_score, 4)
                    ),
                    "constrained_by": explanation.constrained_by,
                    "positive_factors": explanation.positive_factors,
                    "negative_factors": explanation.negative_factors,
                    "fit_debt_applied": round(explanation.fit_debt_applied, 4),
                    "novelty_applied": round(explanation.novelty_applied, 4),
                    "explanation": explanation.explanation,
                    "metadata": explanation.metadata,
                }
            )
        client.table("order_allocation_fit_explanations").insert(explanation_rows).execute()

    return {
        "order_run_id": run_id,
        "status": status,
        "algorithm_version": ALGORITHM_VERSION,
        "scoring_version": plan.scoring_config.version,
        "allocations": len(plan.allocations),
        "order_lines": 0 if plan.has_blockers else len(plan.order_lines),
        "issues": len(plan.issues),
        "selected_offer_sets": len(plan.selected_offer_sets),
        "fit_explanations": len(plan.explanations),
    }


def select_offer_set_for_caterer(
    *,
    caterer_id: str,
    candidates: list[VariantCandidate],
    minimum_tiers: list[dict[str, int]],
    demand: list[StudentDemand],
    profiles_by_student: dict[str, StudentPreferenceProfile],
    scoring_config: MealFitScoringConfig,
    caterer_quality_penalty: float = 0.0,
    leftover_penalty: float = 0.0,
) -> SelectedOfferSet | None:
    """Select a deterministic weekly offer set for one caterer."""
    if not candidates or not demand:
        return None
    candidates = sorted(
        candidates, key=lambda candidate: (candidate.display_name, candidate.option.id)
    )

    tiers = sorted(
        (
            {
                "menu_item_count": int(row["menu_item_count"]),
                "minimum_meals": int(row.get("minimum_meals", 0)),
            }
            for row in minimum_tiers
            if 0 < int(row["menu_item_count"]) <= len(candidates)
        ),
        key=lambda row: row["menu_item_count"],
    )
    if not tiers:
        tiers = [{"menu_item_count": min(len(candidates), 4), "minimum_meals": 0}]

    best: SelectedOfferSet | None = None
    for tier in tiers:
        menu_item_count = tier["menu_item_count"]
        method = (
            "enumerated"
            if comb(len(candidates), menu_item_count) <= MAX_ENUMERATED_SUBSETS
            else "greedy"
        )
        subsets = (
            combinations(candidates, menu_item_count)
            if method == "enumerated"
            else [
                _greedy_subset(
                    candidates, menu_item_count, demand, profiles_by_student, scoring_config
                )
            ]
        )

        for subset_tuple in subsets:
            subset = list(subset_tuple)
            score = _score_offer_subset(
                caterer_id=caterer_id,
                subset=subset,
                minimum_meals=tier["minimum_meals"],
                demand=demand,
                profiles_by_student=profiles_by_student,
                scoring_config=scoring_config,
                caterer_quality_penalty=caterer_quality_penalty,
                leftover_penalty=leftover_penalty,
            )
            if score is None:
                continue
            selected = SelectedOfferSet(
                caterer_id=caterer_id,
                method=method,
                menu_item_count=menu_item_count,
                minimum_meals=tier["minimum_meals"],
                projected_demand=score["projected_demand"],
                forced_waste=score["forced_waste"],
                score=score["score"],
                low_fit_count=score["low_fit_count"],
                recent_repetition=score["recent_repetition"],
                novelty_coverage=score["novelty_coverage"],
                moq_warning_count=1 if score["forced_waste"] > 0 else 0,
                variant_ids=tuple(candidate.option.id for candidate in subset),
                accepted_warnings=(
                    (
                        f"minimum {tier['minimum_meals']} exceeds projected demand "
                        f"{score['projected_demand']}",
                    )
                    if score["forced_waste"] > 0
                    else ()
                ),
            )
            if best is None or _offer_sort_key(selected) < _offer_sort_key(best):
                best = selected

    return best


def _offer_sort_key(selected: SelectedOfferSet) -> tuple[Any, ...]:
    return (
        -round(selected.score, 8),
        selected.low_fit_count,
        round(selected.recent_repetition, 8),
        -round(selected.novelty_coverage, 8),
        selected.moq_warning_count,
        selected.menu_item_count,
        selected.variant_ids,
    )


def _score_offer_subset(
    *,
    caterer_id: str,
    subset: list[VariantCandidate],
    minimum_meals: int,
    demand: list[StudentDemand],
    profiles_by_student: dict[str, StudentPreferenceProfile],
    scoring_config: MealFitScoringConfig,
    caterer_quality_penalty: float,
    leftover_penalty: float,
) -> dict[str, Any] | None:
    chosen_scores: list[ScoreBreakdown] = []
    repetition_values: list[float] = []
    novelty_values: list[float] = []

    for item in demand:
        safe_candidates = [
            candidate
            for candidate in subset
            if is_safe_dish(candidate.option, set(item.dietary_tag_codes))
        ]
        if not safe_candidates:
            return None
        profile = profiles_by_student.get(item.student_id, StudentPreferenceProfile())
        breakdowns = [
            score_candidate(
                profile,
                CandidateContext(
                    variant_id=candidate.option.id,
                    caterer_id=caterer_id,
                    tags=list(candidate.tags),
                    population_prior=candidate.population_prior,
                    caterer_quality_penalty=caterer_quality_penalty,
                    leftover_penalty=leftover_penalty,
                ),
                scoring_config,
            )
            for candidate in safe_candidates
        ]
        chosen = max(
            breakdowns,
            key=lambda score: (
                score.score,
                score.novelty,
                -abs(score.recent_repetition),
            ),
        )
        chosen_scores.append(chosen)
        repetition_values.append(abs(min(0.0, chosen.recent_repetition)))
        novelty_values.append(max(0.0, chosen.novelty))

    projected_demand = len(demand)
    forced_waste = max(0, minimum_meals - projected_demand)
    average_fit = sum(score.score for score in chosen_scores) / max(1, len(chosen_scores))
    score_value = average_fit - scoring_config.weights.waste_weight * forced_waste
    return {
        "score": score_value,
        "projected_demand": projected_demand,
        "forced_waste": forced_waste,
        "low_fit_count": sum(
            1 for score in chosen_scores if score.score < scoring_config.weights.low_fit_threshold
        ),
        "recent_repetition": sum(repetition_values) / max(1, len(repetition_values)),
        "novelty_coverage": sum(novelty_values) / max(1, len(novelty_values)),
    }


def _greedy_subset(
    candidates: list[VariantCandidate],
    menu_item_count: int,
    demand: list[StudentDemand],
    profiles_by_student: dict[str, StudentPreferenceProfile],
    scoring_config: MealFitScoringConfig,
) -> tuple[VariantCandidate, ...]:
    selected: list[VariantCandidate] = []
    remaining = sorted(
        candidates, key=lambda candidate: (candidate.display_name, candidate.option.id)
    )
    while remaining and len(selected) < menu_item_count:
        best_candidate = min(
            remaining,
            key=lambda candidate: _greedy_candidate_key(
                [*selected, candidate], demand, profiles_by_student, scoring_config
            ),
        )
        selected.append(best_candidate)
        remaining = [
            candidate for candidate in remaining if candidate.option.id != best_candidate.option.id
        ]
    return tuple(selected)


def _greedy_candidate_key(
    subset: list[VariantCandidate],
    demand: list[StudentDemand],
    profiles_by_student: dict[str, StudentPreferenceProfile],
    scoring_config: MealFitScoringConfig,
) -> tuple[Any, ...]:
    coverage = 0
    total_score = 0.0
    for item in demand:
        safe = [
            candidate
            for candidate in subset
            if is_safe_dish(candidate.option, set(item.dietary_tag_codes))
        ]
        if not safe:
            continue
        coverage += 1
        profile = profiles_by_student.get(item.student_id, StudentPreferenceProfile())
        total_score += max(
            score_candidate(
                profile,
                CandidateContext(
                    variant_id=candidate.option.id,
                    caterer_id=candidate.caterer_id,
                    tags=list(candidate.tags),
                    population_prior=candidate.population_prior,
                ),
                scoring_config,
            ).score
            for candidate in safe
        )
    stable_ids = tuple(candidate.option.id for candidate in subset)
    return (-coverage, -total_score, stable_ids)


def _load_data(client: Client, service_week_start: date) -> _LoadedData:
    service_week_end = _week_end(service_week_start)
    scoring_config = _load_scoring_config(client)

    schools = {row["id"]: row for row in _select(client, "schools", "id, canonical_name")}
    caterers = {
        row["id"]: row
        for row in _select(client, "caterers", "id, name, per_item_price_cents, gst_inclusive")
    }
    sessions = [
        row
        for row in _select(
            client, "sessions", "id, school_id, caterer_id, session_date, year_levels"
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
    sessions_by_id = {row["id"]: row for row in sessions}

    students = {
        row["id"]: row
        for row in _select(client, "students", "id, school_id, full_name, year_level, opted_out")
    }
    enrolments_by_session: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in _select(client, "session_enrolments", "session_id, student_id"):
        if row["session_id"] in sessions_by_id:
            enrolments_by_session[row["session_id"]].append(row)
    for session_id in enrolments_by_session:
        enrolments_by_session[session_id].sort(
            key=lambda row: (
                students.get(row["student_id"], {}).get("full_name", ""),
                row["student_id"],
            )
        )

    tags_by_student: dict[str, set[str]] = defaultdict(set)
    for row in _select(client, "student_dietary_tags", "student_id, tag_code"):
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

    candidates_by_caterer = _load_candidates(client, scoring_config)
    minimums_by_caterer: dict[str, list[dict[str, int]]] = defaultdict(list)
    for row in _select(
        client, "caterer_weekly_minimums", "caterer_id, menu_item_count, minimum_meals"
    ):
        minimums_by_caterer[row["caterer_id"]].append(row)
    for caterer_id in minimums_by_caterer:
        minimums_by_caterer[caterer_id].sort(key=lambda row: row["menu_item_count"])

    profiles = _load_profiles(client, service_week_start, candidates_by_caterer, scoring_config)
    return _LoadedData(
        service_week_start=service_week_start,
        service_week_end=service_week_end,
        scoring_config=scoring_config,
        schools=schools,
        caterers=caterers,
        sessions=sessions,
        sessions_by_id=sessions_by_id,
        students=students,
        enrolments_by_session=enrolments_by_session,
        tags_by_student=tags_by_student,
        pending_warning_students=pending_warning_students,
        excluded_years_by_session=excluded_years_by_session,
        absent_pairs=absent_pairs,
        candidates_by_caterer=candidates_by_caterer,
        minimums_by_caterer=minimums_by_caterer,
        profiles_by_student=profiles["profiles_by_student"],
        caterer_quality_penalties=profiles["caterer_quality_penalties"],
        leftover_penalties=profiles["leftover_penalties"],
    )


def _load_scoring_config(client: Client) -> MealFitScoringConfig:
    rows = [
        row
        for row in _select(
            client, "meal_fit_scoring_versions", "version, weights, decay_config, is_active"
        )
        if row.get("is_active")
    ]
    rows.sort(key=lambda row: (row.get("version") != DEFAULT_VERSION, row.get("version", "")))
    return config_from_row(rows[0] if rows else None)


def _load_candidates(
    client: Client,
    scoring_config: MealFitScoringConfig,
) -> dict[str, list[VariantCandidate]]:
    active_tags = {
        row["code"]
        for row in _select(client, "preference_tags", "code, is_active")
        if row.get("is_active")
    }
    tags_by_variant: dict[str, list[DishTag]] = defaultdict(list)
    for row in _select(
        client,
        "dish_variant_tags",
        "dish_variant_id, tag_code, tag_source, confidence",
    ):
        tag_code = row["tag_code"]
        if tag_code not in active_tags:
            continue
        confidence = _as_float(row.get("confidence"), 1.0)
        if (
            row.get("tag_source") == "ai_suggested"
            and confidence < scoring_config.decay_config.minimum_ai_tag_confidence
        ):
            continue
        tags_by_variant[row["dish_variant_id"]].append(DishTag(tag_code, clamp(confidence, 0, 1)))

    population_prior = _load_population_prior(client)
    dishes = {row["id"]: row for row in _select(client, "dishes", "id, caterer_id, name")}
    candidates_by_caterer: dict[str, list[VariantCandidate]] = defaultdict(list)
    variant_columns = (
        "id, dish_id, name, is_available, is_gluten_free, is_dairy_free, is_nut_free, "
        "is_vegetarian_option, is_halal_inferred, has_no_declared_tags, contains_beef, "
        "contains_pork, contains_red_meat, contains_fish, contains_shellfish, "
        "ingredient_flags_source"
    )
    for row in _select(client, "dish_variants", variant_columns):
        dish = dishes.get(row["dish_id"])
        if (
            not dish
            or not row.get("is_available")
            or row.get("ingredient_flags_source") != "operator_reviewed"
        ):
            continue
        display_name = (
            dish["name"] if row["name"] == "Standard" else f"{dish['name']} - {row['name']}"
        )
        variant_row = {**row, "display_name": display_name}
        candidate = VariantCandidate(
            option=_dish_option(variant_row),
            caterer_id=dish["caterer_id"],
            dish_id=row["dish_id"],
            display_name=display_name,
            tags=tuple(sorted(tags_by_variant.get(row["id"], []), key=lambda tag: tag.tag_code)),
            population_prior=population_prior.get(row["id"], 0.0),
        )
        candidates_by_caterer[dish["caterer_id"]].append(candidate)

    for caterer_id in candidates_by_caterer:
        candidates_by_caterer[caterer_id].sort(
            key=lambda candidate: (candidate.display_name, candidate.option.id)
        )
    return candidates_by_caterer


def _load_population_prior(client: Client) -> dict[str, float]:
    values: dict[str, list[float]] = defaultdict(list)
    for row in _select(client, "student_meal_feedback", "dish_variant_id, rating, liked"):
        variant_id = row.get("dish_variant_id")
        if not variant_id:
            continue
        score = _feedback_score(row)
        if score is not None:
            values[variant_id].append(score)
    return {
        variant_id: clamp(sum(scores) / len(scores))
        for variant_id, scores in values.items()
        if scores
    }


def _load_profiles(
    client: Client,
    service_week_start: date,
    candidates_by_caterer: dict[str, list[VariantCandidate]],
    scoring_config: MealFitScoringConfig,
) -> dict[str, Any]:
    profiles: dict[str, StudentPreferenceProfile] = {}
    mutable_signals: dict[str, dict[str, PreferenceSignal]] = defaultdict(dict)
    for row in _select(
        client,
        "student_preference_signals",
        "student_id, tag_code, affinity_score, confidence, feedback_count",
    ):
        mutable_signals[row["student_id"]][row["tag_code"]] = PreferenceSignal(
            affinity_score=_as_float(row["affinity_score"]),
            confidence=_as_float(row["confidence"]),
            feedback_count=int(row.get("feedback_count") or 0),
        )

    direct_scores: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for row in _select(
        client, "student_meal_feedback", "student_id, dish_variant_id, rating, liked"
    ):
        if not row.get("dish_variant_id"):
            continue
        score = _feedback_score(row)
        if score is not None:
            direct_scores[row["student_id"]][row["dish_variant_id"]].append(score)

    recent_variant_ids, recent_tag_codes = _load_recent_allocations(
        client, service_week_start, candidates_by_caterer, scoring_config
    )
    fit_debt_by_student = {
        row["student_id"]: _as_float(row["fit_debt_score"])
        for row in _select(
            client, "student_fit_debt", "student_id, service_week_start, fit_debt_score"
        )
        if row["service_week_start"] == service_week_start.isoformat()
    }

    all_student_ids = (
        set(mutable_signals)
        | set(direct_scores)
        | set(recent_variant_ids)
        | set(fit_debt_by_student)
    )
    for student_id in all_student_ids:
        profiles[student_id] = StudentPreferenceProfile(
            tag_signals=mutable_signals.get(student_id, {}),
            direct_variant_scores={
                variant_id: clamp(sum(scores) / len(scores))
                for variant_id, scores in direct_scores.get(student_id, {}).items()
            },
            recent_variant_ids=recent_variant_ids.get(student_id, set()),
            recent_tag_codes=recent_tag_codes.get(student_id, set()),
            fit_debt_score=fit_debt_by_student.get(student_id, 0.0),
        )

    return {
        "profiles_by_student": profiles,
        "caterer_quality_penalties": _load_caterer_quality_penalties(client),
        "leftover_penalties": _load_leftover_penalties(client),
    }


def _feedback_score(row: dict[str, Any]) -> float | None:
    if row.get("rating") is not None:
        return clamp((_as_float(row["rating"]) - 3.0) / 2.0)
    if row.get("liked") is True:
        return 0.5
    if row.get("liked") is False:
        return -0.5
    return None


def _load_recent_allocations(
    client: Client,
    service_week_start: date,
    candidates_by_caterer: dict[str, list[VariantCandidate]],
    scoring_config: MealFitScoringConfig,
) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    tags_by_variant = {
        candidate.option.id: {tag.tag_code for tag in candidate.tags}
        for candidates in candidates_by_caterer.values()
        for candidate in candidates
    }
    window_start = service_week_start - timedelta(
        weeks=scoring_config.decay_config.recent_repetition_window_weeks
    )
    recent_run_ids = {
        row["id"]
        for row in _select(client, "order_runs", "id, service_week_start, status")
        if row.get("status") in {"generated", "approved", "superseded"}
        and window_start <= date.fromisoformat(str(row["service_week_start"])) < service_week_start
    }
    recent_variant_ids: dict[str, set[str]] = defaultdict(set)
    recent_tag_codes: dict[str, set[str]] = defaultdict(set)
    for row in _select(
        client, "order_allocations", "order_run_id, student_id, dish_variant_id, status"
    ):
        if row.get("order_run_id") not in recent_run_ids or row.get("status") != "allocated":
            continue
        variant_id = row.get("dish_variant_id")
        if not variant_id:
            continue
        recent_variant_ids[row["student_id"]].add(variant_id)
        recent_tag_codes[row["student_id"]].update(tags_by_variant.get(variant_id, set()))
    return recent_variant_ids, recent_tag_codes


def _load_caterer_quality_penalties(client: Client) -> dict[str, float]:
    severity_scores = {"info": 0.05, "review": 0.25, "serious": 0.65}
    values: dict[str, list[float]] = defaultdict(list)
    for row in _select(client, "caterer_quality_events", "caterer_id, severity, event_type"):
        value = severity_scores.get(row.get("severity"), 0.0)
        if row.get("event_type") == "positive_feedback":
            value = -0.1
        values[row["caterer_id"]].append(value)
    return {
        caterer_id: clamp(sum(items) / max(1, len(items)), 0.0, 1.0)
        for caterer_id, items in values.items()
    }


def _load_leftover_penalties(client: Client) -> dict[str, float]:
    leftover_scores = {"none": 0.0, "low": 0.1, "moderate": 0.35, "high": 0.7, "unknown": 0.0}
    session_caterer_ids = {
        row["id"]: row["caterer_id"] for row in _select(client, "sessions", "id, caterer_id")
    }
    values: dict[str, list[float]] = defaultdict(list)
    for row in _select(
        client,
        "session_catering_feedback",
        "session_id, caterer_id, leftover_level",
    ):
        caterer_id = row.get("caterer_id") or session_caterer_ids.get(row.get("session_id"))
        if not caterer_id:
            continue
        values[caterer_id].append(leftover_scores.get(row.get("leftover_level"), 0.0))
    return {
        caterer_id: clamp(sum(items) / max(1, len(items)), 0.0, 1.0)
        for caterer_id, items in values.items()
    }


def _build_demand(
    data: _LoadedData,
) -> tuple[dict[str, list[StudentDemand]], list[AllocationDraft], list[IssueDraft]]:
    demand_by_caterer: dict[str, list[StudentDemand]] = defaultdict(list)
    skipped_allocations: list[AllocationDraft] = []
    issues: list[IssueDraft] = []
    for session in data.sessions:
        session_id = session["id"]
        excluded_years = data.excluded_years_by_session.get(session_id, set())
        for enrolment in data.enrolments_by_session.get(session_id, []):
            student_id = enrolment["student_id"]
            student = data.students.get(student_id)
            if not student:
                continue
            tag_codes = tuple(sorted(data.tags_by_student.get(student_id, set())))
            allocation_base = {
                "session_id": session_id,
                "student_id": student_id,
                "dish_id": None,
                "dish_variant_id": None,
                "dietary_tag_codes": list(tag_codes),
            }
            if student["opted_out"]:
                skipped_allocations.append(
                    AllocationDraft(
                        **allocation_base,
                        status="skipped_opted_out",
                        reason_codes=["opted_out"],
                    )
                )
                continue
            if (session_id, student_id) in data.absent_pairs:
                skipped_allocations.append(
                    AllocationDraft(
                        **allocation_base, status="skipped_absent", reason_codes=["absent"]
                    )
                )
                continue
            if student["year_level"] in excluded_years:
                skipped_allocations.append(
                    AllocationDraft(
                        **allocation_base,
                        status="skipped_year_excluded",
                        reason_codes=["year_excluded"],
                    )
                )
                continue
            if student_id in data.pending_warning_students:
                skipped_allocations.append(
                    AllocationDraft(
                        **allocation_base,
                        status="blocked_pending_dietary_warning",
                        reason_codes=["pending_dietary_warning"],
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
            demand_by_caterer[session["caterer_id"]].append(
                StudentDemand(
                    session_id=session_id,
                    student_id=student_id,
                    caterer_id=session["caterer_id"],
                    dietary_tag_codes=tag_codes,
                )
            )
    return demand_by_caterer, skipped_allocations, issues


def _allocate(
    data: _LoadedData,
    selected_by_caterer: dict[str, SelectedOfferSet],
) -> tuple[
    list[AllocationDraft], list[OrderLineDraft], list[IssueDraft], list[AllocationExplanationDraft]
]:
    selected_variants = {
        variant_id
        for selected in selected_by_caterer.values()
        for variant_id in selected.variant_ids
    }
    candidate_by_id = {
        candidate.option.id: candidate
        for candidates in data.candidates_by_caterer.values()
        for candidate in candidates
        if candidate.option.id in selected_variants
    }
    selected_candidates_by_caterer: dict[str, list[VariantCandidate]] = defaultdict(list)
    for selected in selected_by_caterer.values():
        selected_candidates_by_caterer[selected.caterer_id] = [
            candidate_by_id[variant_id]
            for variant_id in selected.variant_ids
            if variant_id in candidate_by_id
        ]

    allocations: list[AllocationDraft] = []
    issues: list[IssueDraft] = []
    explanations: list[AllocationExplanationDraft] = []
    line_counts: Counter[tuple[str, str]] = Counter()
    session_dish_counts: dict[str, dict[str, int]] = defaultdict(dict)
    no_offer_issue_sessions: set[str] = set()

    for session in data.sessions:
        session_id = session["id"]
        caterer_id = session["caterer_id"]
        offered = selected_candidates_by_caterer.get(caterer_id, [])
        excluded_years = data.excluded_years_by_session.get(session_id, set())
        for enrolment in data.enrolments_by_session.get(session_id, []):
            student_id = enrolment["student_id"]
            student = data.students.get(student_id)
            if not student:
                continue
            tag_codes = sorted(data.tags_by_student.get(student_id, set()))
            tag_set = set(tag_codes)
            if (
                student["opted_out"]
                or (session_id, student_id) in data.absent_pairs
                or student["year_level"] in excluded_years
                or student_id in data.pending_warning_students
            ):
                continue
            if not offered:
                allocations.append(
                    AllocationDraft(
                        session_id=session_id,
                        student_id=student_id,
                        dish_id=None,
                        dish_variant_id=None,
                        status="blocked_no_menu_offer",
                        reason_codes=["no_menu_offer"],
                        dietary_tag_codes=tag_codes,
                    )
                )
                if session_id not in no_offer_issue_sessions:
                    no_offer_issue_sessions.add(session_id)
                    issues.append(
                        IssueDraft(
                            severity="error",
                            code="no_menu_offer",
                            message=(
                                f"{data.caterers.get(caterer_id, {}).get('name', caterer_id)} "
                                "has no selected meal-fit offer set for this session."
                            ),
                            session_id=session_id,
                            details={"caterer_id": caterer_id},
                        )
                    )
                continue

            safe_candidates = [
                candidate for candidate in offered if is_safe_dish(candidate.option, tag_set)
            ]
            if not safe_candidates:
                allocations.append(
                    AllocationDraft(
                        session_id=session_id,
                        student_id=student_id,
                        dish_id=None,
                        dish_variant_id=None,
                        status="blocked_no_safe_dish",
                        reason_codes=["no_safe_dish"],
                        dietary_tag_codes=tag_codes,
                    )
                )
                issues.append(
                    IssueDraft(
                        severity="error",
                        code="no_safe_dish",
                        message=f"{student['full_name']} has no safe meal-fit offered dish.",
                        session_id=session_id,
                        student_id=student_id,
                        details={"dietary_tag_codes": tag_codes, "caterer_id": caterer_id},
                    )
                )
                continue

            chosen, chosen_breakdown, top_candidate, top_breakdown = _choose_candidate(
                student_id=student_id,
                caterer_id=caterer_id,
                candidates=safe_candidates,
                session_counts=session_dish_counts[session_id],
                profiles_by_student=data.profiles_by_student,
                scoring_config=data.scoring_config,
                caterer_quality_penalty=data.caterer_quality_penalties.get(caterer_id, 0.0),
                leftover_penalty=data.leftover_penalties.get(caterer_id, 0.0),
            )
            session_dish_counts[session_id][chosen.option.id] = (
                session_dish_counts[session_id].get(chosen.option.id, 0) + 1
            )
            line_counts[(session_id, chosen.option.id)] += 1
            allocations.append(
                AllocationDraft(
                    session_id=session_id,
                    student_id=student_id,
                    dish_id=chosen.dish_id,
                    dish_variant_id=chosen.option.id,
                    status="allocated",
                    reason_codes=[],
                    dietary_tag_codes=tag_codes,
                )
            )
            explanations.append(
                _build_explanation(
                    session_id=session_id,
                    student_id=student_id,
                    chosen=chosen,
                    chosen_breakdown=chosen_breakdown,
                    top_candidate=top_candidate,
                    top_breakdown=top_breakdown,
                    tag_set=tag_set,
                    candidates=offered,
                    scoring_version=data.scoring_config.version,
                )
            )

    order_lines: list[OrderLineDraft] = []
    for (session_id, dish_variant_id), quantity in sorted(line_counts.items()):
        session = data.sessions_by_id[session_id]
        caterer = data.caterers[session["caterer_id"]]
        candidate = candidate_by_id[dish_variant_id]
        unit_price = caterer["per_item_price_cents"]
        order_lines.append(
            OrderLineDraft(
                session_id=session_id,
                dish_id=candidate.dish_id,
                dish_variant_id=dish_variant_id,
                quantity=quantity,
                unit_price_cents=unit_price,
                gst_inclusive=caterer["gst_inclusive"],
                line_total_cents=unit_price * quantity,
            )
        )
    return allocations, order_lines, issues, explanations


def _choose_candidate(
    *,
    student_id: str,
    caterer_id: str,
    candidates: list[VariantCandidate],
    session_counts: dict[str, int],
    profiles_by_student: dict[str, StudentPreferenceProfile],
    scoring_config: MealFitScoringConfig,
    caterer_quality_penalty: float,
    leftover_penalty: float,
) -> tuple[VariantCandidate, ScoreBreakdown, VariantCandidate, ScoreBreakdown]:
    profile = profiles_by_student.get(student_id, StudentPreferenceProfile())
    scored = [
        (
            candidate,
            score_candidate(
                profile,
                CandidateContext(
                    variant_id=candidate.option.id,
                    caterer_id=caterer_id,
                    tags=list(candidate.tags),
                    population_prior=candidate.population_prior,
                    caterer_quality_penalty=caterer_quality_penalty,
                    leftover_penalty=leftover_penalty,
                ),
                scoring_config,
            ),
        )
        for candidate in candidates
    ]
    top_candidate, top_breakdown = max(
        scored,
        key=lambda item: (item[1].score, item[1].novelty, item[0].display_name, item[0].option.id),
    )
    chosen_candidate, chosen_breakdown = max(
        scored,
        key=lambda item: (
            item[1].score,
            -session_counts.get(item[0].option.id, 0),
            item[1].novelty,
            item[0].display_name,
            item[0].option.id,
        ),
    )
    return chosen_candidate, chosen_breakdown, top_candidate, top_breakdown


def _build_explanation(
    *,
    session_id: str,
    student_id: str,
    chosen: VariantCandidate,
    chosen_breakdown: ScoreBreakdown,
    top_candidate: VariantCandidate,
    top_breakdown: ScoreBreakdown,
    tag_set: set[str],
    candidates: list[VariantCandidate],
    scoring_version: str,
) -> AllocationExplanationDraft:
    constrained_by = sorted(
        {
            reason
            for candidate in candidates
            for reason in dish_failure_reasons(candidate.option, tag_set)
        }
    )
    if chosen.option.id == top_candidate.option.id:
        explanation = f"Selected {chosen.display_name} as the highest scoring safe option."
    else:
        explanation = (
            f"Selected {chosen.display_name}; {top_candidate.display_name} was the top "
            "feasible preference score before session balancing."
        )
    return AllocationExplanationDraft(
        session_id=session_id,
        student_id=student_id,
        dish_variant_id=chosen.option.id,
        scoring_version=scoring_version,
        chosen_score=chosen_breakdown.score,
        top_feasible_variant_id=top_candidate.option.id,
        top_feasible_score=top_breakdown.score,
        constrained_by=constrained_by,
        positive_factors=chosen_breakdown.positive_factors,
        negative_factors=chosen_breakdown.negative_factors,
        fit_debt_applied=chosen_breakdown.fit_debt,
        novelty_applied=chosen_breakdown.novelty,
        explanation=explanation,
        metadata={
            "components": {
                "tag_affinity": round(chosen_breakdown.tag_affinity, 4),
                "direct_rating": round(chosen_breakdown.direct_rating, 4),
                "population_prior": round(chosen_breakdown.population_prior, 4),
                "novelty": round(chosen_breakdown.novelty, 4),
                "recent_repetition": round(chosen_breakdown.recent_repetition, 4),
                "caterer_quality": round(chosen_breakdown.caterer_quality, 4),
                "leftover": round(chosen_breakdown.leftover, 4),
                "fit_debt": round(chosen_breakdown.fit_debt, 4),
            }
        },
    )
