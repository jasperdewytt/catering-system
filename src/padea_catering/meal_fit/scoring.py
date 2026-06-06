"""Pure meal-fit scoring primitives.

Preference scoring is advisory only: callers must run deterministic safety
filters before calling these functions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

DEFAULT_VERSION = "meal_fit_v1"


@dataclass(frozen=True)
class MealFitWeights:
    w1_tag_affinity: float = 2.0
    w2_direct_rating: float = 2.5
    w3_population_prior: float = 1.0
    w4_novelty: float = 0.75
    w5_recent_repetition: float = 1.0
    w6_caterer_quality: float = 1.0
    w7_leftover_penalty: float = 0.75
    fit_debt_weight: float = 1.5
    fit_debt_cap: float = 2.0
    waste_weight: float = 0.35
    low_fit_threshold: float = 0.0


@dataclass(frozen=True)
class MealFitDecayConfig:
    tag_affinity_half_life_weeks: int = 8
    direct_rating_half_life_weeks: int = 10
    recent_repetition_window_weeks: int = 3
    fit_debt_weekly_decay: float = 0.25
    exploration_bonus_after_try_decay: float = 1.0
    minimum_ai_tag_confidence: float = 0.70
    minimum_ai_auto_handle_confidence: float = 0.80
    score_range: tuple[float, float] = (-1.0, 1.0)


@dataclass(frozen=True)
class MealFitScoringConfig:
    version: str = DEFAULT_VERSION
    weights: MealFitWeights = field(default_factory=MealFitWeights)
    decay_config: MealFitDecayConfig = field(default_factory=MealFitDecayConfig)


@dataclass(frozen=True)
class PreferenceSignal:
    affinity_score: float
    confidence: float
    feedback_count: int = 0


@dataclass(frozen=True)
class DishTag:
    tag_code: str
    confidence: float


@dataclass(frozen=True)
class StudentPreferenceProfile:
    tag_signals: dict[str, PreferenceSignal] = field(default_factory=dict)
    direct_variant_scores: dict[str, float] = field(default_factory=dict)
    recent_variant_ids: set[str] = field(default_factory=set)
    recent_tag_codes: set[str] = field(default_factory=set)
    fit_debt_score: float = 0.0


@dataclass(frozen=True)
class CandidateContext:
    variant_id: str
    caterer_id: str
    tags: list[DishTag] = field(default_factory=list)
    population_prior: float = 0.0
    caterer_quality_penalty: float = 0.0
    leftover_penalty: float = 0.0


@dataclass(frozen=True)
class ScoreBreakdown:
    score: float
    tag_affinity: float
    direct_rating: float
    population_prior: float
    novelty: float
    recent_repetition: float
    caterer_quality: float
    leftover: float
    fit_debt: float
    positive_factors: list[dict[str, Any]]
    negative_factors: list[dict[str, Any]]


def clamp(value: float, lower: float = -1.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def config_from_row(row: dict[str, Any] | None) -> MealFitScoringConfig:
    """Build config from a Supabase row, falling back to frozen v1 constants."""
    if not row:
        return MealFitScoringConfig()

    weights_data = row.get("weights") or {}
    decay_data = row.get("decay_config") or {}
    score_range = decay_data.get("score_range", [-1, 1])
    return MealFitScoringConfig(
        version=row.get("version") or DEFAULT_VERSION,
        weights=MealFitWeights(
            **{
                field_name: float(
                    weights_data.get(field_name, getattr(MealFitWeights(), field_name))
                )
                for field_name in MealFitWeights.__dataclass_fields__
            }
        ),
        decay_config=MealFitDecayConfig(
            tag_affinity_half_life_weeks=int(decay_data.get("tag_affinity_half_life_weeks", 8)),
            direct_rating_half_life_weeks=int(decay_data.get("direct_rating_half_life_weeks", 10)),
            recent_repetition_window_weeks=int(decay_data.get("recent_repetition_window_weeks", 3)),
            fit_debt_weekly_decay=float(decay_data.get("fit_debt_weekly_decay", 0.25)),
            exploration_bonus_after_try_decay=float(
                decay_data.get("exploration_bonus_after_try_decay", 1.0)
            ),
            minimum_ai_tag_confidence=float(decay_data.get("minimum_ai_tag_confidence", 0.70)),
            minimum_ai_auto_handle_confidence=float(
                decay_data.get("minimum_ai_auto_handle_confidence", 0.80)
            ),
            score_range=(float(score_range[0]), float(score_range[1])),
        ),
    )


def score_candidate(
    profile: StudentPreferenceProfile,
    candidate: CandidateContext,
    config: MealFitScoringConfig,
) -> ScoreBreakdown:
    """Return a bounded preference score for one already-safe candidate."""
    weights = config.weights

    tag_affinity = _tag_affinity(profile, candidate)
    direct_rating = clamp(profile.direct_variant_scores.get(candidate.variant_id, 0.0))
    population_prior = clamp(candidate.population_prior)
    novelty = _novelty(profile, candidate)
    recent_repetition = _recent_repetition(profile, candidate)
    caterer_quality = -abs(clamp(candidate.caterer_quality_penalty, 0.0, 1.0))
    leftover = -abs(clamp(candidate.leftover_penalty, 0.0, 1.0))
    fit_debt = clamp(profile.fit_debt_score / max(weights.fit_debt_cap, 0.001), 0.0, 1.0)

    weighted = (
        weights.w1_tag_affinity * tag_affinity
        + weights.w2_direct_rating * direct_rating
        + weights.w3_population_prior * population_prior
        + weights.w4_novelty * novelty
        + weights.w5_recent_repetition * recent_repetition
        + weights.w6_caterer_quality * caterer_quality
        + weights.w7_leftover_penalty * leftover
        + weights.fit_debt_weight * fit_debt
    )
    denominator = (
        weights.w1_tag_affinity
        + weights.w2_direct_rating
        + weights.w3_population_prior
        + weights.w4_novelty
        + weights.w5_recent_repetition
        + weights.w6_caterer_quality
        + weights.w7_leftover_penalty
        + weights.fit_debt_weight
    )
    score = clamp(weighted / denominator)

    positive_factors, negative_factors = _factor_lists(
        {
            "tag affinity": tag_affinity,
            "direct feedback": direct_rating,
            "population prior": population_prior,
            "novelty": novelty,
            "recent repetition": recent_repetition,
            "caterer quality": caterer_quality,
            "leftovers": leftover,
            "fit debt": fit_debt,
        }
    )

    return ScoreBreakdown(
        score=score,
        tag_affinity=tag_affinity,
        direct_rating=direct_rating,
        population_prior=population_prior,
        novelty=novelty,
        recent_repetition=recent_repetition,
        caterer_quality=caterer_quality,
        leftover=leftover,
        fit_debt=fit_debt,
        positive_factors=positive_factors,
        negative_factors=negative_factors,
    )


def _tag_affinity(profile: StudentPreferenceProfile, candidate: CandidateContext) -> float:
    if not candidate.tags:
        return 0.0

    weighted_total = 0.0
    confidence_total = 0.0
    for dish_tag in candidate.tags:
        signal = profile.tag_signals.get(dish_tag.tag_code)
        if signal is None:
            continue
        evidence_scale = min(1.0, max(0.25, signal.feedback_count / 4))
        confidence = clamp(signal.confidence, 0.0, 1.0) * clamp(dish_tag.confidence, 0.0, 1.0)
        weighted_total += clamp(signal.affinity_score) * confidence * evidence_scale
        confidence_total += confidence

    if confidence_total == 0:
        return 0.0
    return clamp(weighted_total / confidence_total)


def _novelty(profile: StudentPreferenceProfile, candidate: CandidateContext) -> float:
    if candidate.variant_id in profile.recent_variant_ids:
        return -1.0
    if not candidate.tags:
        return 0.2
    candidate_tags = {tag.tag_code for tag in candidate.tags}
    unseen = candidate_tags - profile.recent_tag_codes
    return clamp(len(unseen) / len(candidate_tags))


def _recent_repetition(profile: StudentPreferenceProfile, candidate: CandidateContext) -> float:
    if candidate.variant_id in profile.recent_variant_ids:
        return -1.0
    if {tag.tag_code for tag in candidate.tags} & profile.recent_tag_codes:
        return -0.35
    return 0.0


def _factor_lists(
    components: dict[str, float],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    positive: list[dict[str, Any]] = []
    negative: list[dict[str, Any]] = []
    for label, value in components.items():
        rounded = round(value, 4)
        if rounded > 0.05:
            positive.append({"factor": label, "value": rounded})
        elif rounded < -0.05:
            negative.append({"factor": label, "value": rounded})
    positive.sort(key=lambda item: (-item["value"], item["factor"]))
    negative.sort(key=lambda item: (item["value"], item["factor"]))
    return positive, negative
