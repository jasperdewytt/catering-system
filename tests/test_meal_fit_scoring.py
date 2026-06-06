"""Unit tests for meal-fit scoring primitives."""

from __future__ import annotations

from padea_catering.meal_fit.scoring import (
    CandidateContext,
    DishTag,
    MealFitScoringConfig,
    PreferenceSignal,
    StudentPreferenceProfile,
    score_candidate,
)


def test_tag_affinity_respects_confidence_and_feedback_count() -> None:
    config = MealFitScoringConfig()
    candidate = CandidateContext(
        variant_id="variant-1",
        caterer_id="caterer-1",
        tags=[DishTag("wrap", 1.0), DishTag("salad", 1.0), DishTag("unknown", 1.0)],
    )
    confident_profile = StudentPreferenceProfile(
        tag_signals={
            "wrap": PreferenceSignal(affinity_score=1.0, confidence=1.0, feedback_count=4),
            "salad": PreferenceSignal(affinity_score=-1.0, confidence=0.25, feedback_count=1),
        }
    )
    weak_profile = StudentPreferenceProfile(
        tag_signals={
            "wrap": PreferenceSignal(affinity_score=1.0, confidence=0.1, feedback_count=1),
            "salad": PreferenceSignal(affinity_score=-1.0, confidence=0.25, feedback_count=1),
        }
    )

    confident = score_candidate(confident_profile, candidate, config)
    weak = score_candidate(weak_profile, candidate, config)

    assert confident.tag_affinity > weak.tag_affinity
    assert confident.tag_affinity > 0


def test_scores_are_bounded_and_deterministic() -> None:
    config = MealFitScoringConfig()
    candidate = CandidateContext(
        variant_id="variant-1",
        caterer_id="caterer-1",
        tags=[DishTag("wrap", 1.0)],
        population_prior=3.0,
        caterer_quality_penalty=2.0,
        leftover_penalty=2.0,
    )
    profile = StudentPreferenceProfile(
        tag_signals={"wrap": PreferenceSignal(1.0, 1.0, 10)},
        direct_variant_scores={"variant-1": 4.0},
        fit_debt_score=10.0,
    )

    first = score_candidate(profile, candidate, config)
    second = score_candidate(profile, candidate, config)

    assert -1 <= first.score <= 1
    assert first == second


def test_fit_debt_boosts_score_without_changing_safety_context() -> None:
    config = MealFitScoringConfig()
    candidate = CandidateContext(variant_id="variant-1", caterer_id="caterer-1")

    baseline = score_candidate(StudentPreferenceProfile(), candidate, config)
    boosted = score_candidate(
        StudentPreferenceProfile(fit_debt_score=2.0),
        candidate,
        config,
    )

    assert boosted.score > baseline.score
    assert boosted.fit_debt == 1.0


def test_recent_repetition_and_novelty_move_scores_in_expected_direction() -> None:
    config = MealFitScoringConfig()
    candidate = CandidateContext(
        variant_id="variant-1",
        caterer_id="caterer-1",
        tags=[DishTag("wrap", 1.0)],
    )
    fresh_profile = StudentPreferenceProfile()
    repeated_profile = StudentPreferenceProfile(
        recent_variant_ids={"variant-1"},
        recent_tag_codes={"wrap"},
    )

    fresh = score_candidate(fresh_profile, candidate, config)
    repeated = score_candidate(repeated_profile, candidate, config)

    assert fresh.novelty > repeated.novelty
    assert repeated.recent_repetition < fresh.recent_repetition
    assert fresh.score > repeated.score


def test_quality_and_leftover_signals_apply_as_penalties() -> None:
    config = MealFitScoringConfig()
    clean = CandidateContext(variant_id="variant-1", caterer_id="caterer-1")
    penalised = CandidateContext(
        variant_id="variant-1",
        caterer_id="caterer-1",
        caterer_quality_penalty=0.8,
        leftover_penalty=0.6,
    )

    clean_score = score_candidate(StudentPreferenceProfile(), clean, config)
    penalised_score = score_candidate(StudentPreferenceProfile(), penalised, config)

    assert penalised_score.caterer_quality < 0
    assert penalised_score.leftover < 0
    assert penalised_score.score < clean_score.score
