"""Stage 7A caterer reply intake and deterministic handling policy."""

from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Any

from padea_catering.communications import record_communication_export, send_caterer_emails
from padea_catering.llm import LLMProvider, interpret_caterer_reply
from padea_catering.meal_fit.scoring import (
    DEFAULT_VERSION,
    CandidateContext,
    DishTag,
    MealFitScoringConfig,
    PreferenceSignal,
    StudentPreferenceProfile,
    clamp,
    config_from_row,
    score_candidate,
)
from padea_catering.ordering.rules import DishOption, dish_failure_reasons
from supabase import Client

DEFAULT_PROVIDER = "paste_in"
DEFAULT_ACTOR = "Autopilot"
DEFAULT_MINIMUM_AUTO_HANDLE_CONFIDENCE = 0.80
TERMINAL_REPLY_STATUSES = {"auto_handled", "auto_adjusted", "escalated", "ignored", "failed"}
REVISION_ALGORITHM_VERSION = "reply-revision-v1"

INTENT_TO_DB = {
    "confirmed": "confirmation",
    "unavailable_item": "item_unavailable",
    "quantity_question": "quantity_question",
    "delivery_question": "delivery_question",
    "ingredient_change": "other",
    "other": "other",
    "ambiguous": "unknown",
}


def record_and_handle_caterer_reply(
    client: Client,
    *,
    order_run_id: str,
    caterer_id: str,
    raw_body: str,
    communication_id: str | None = None,
    subject: str | None = None,
    from_email: str | None = None,
    received_at: str | None = None,
    provider_thread_id: str | None = None,
    provider_message_id: str | None = None,
    in_reply_to_message_id: str | None = None,
    reference_message_ids: list[str] | None = None,
    idempotency_key: str | None = None,
    actor_name: str | None = None,
    provider: LLMProvider | None = None,
    intake_provider: str | None = None,
) -> dict[str, Any]:
    """Insert or reuse a caterer reply, then run Stage 7A handling policy."""
    order_run_id = _required("order_run_id", order_run_id)
    caterer_id = _required("caterer_id", caterer_id)
    raw_body = _required("raw_body", raw_body)
    actor_name = (actor_name or "").strip() or DEFAULT_ACTOR
    intake_provider = (intake_provider or "").strip() or DEFAULT_PROVIDER
    key = _reply_idempotency_key(
        order_run_id=order_run_id,
        caterer_id=caterer_id,
        subject=subject,
        raw_body=raw_body,
        provider_message_id=provider_message_id,
        idempotency_key=idempotency_key,
    )

    existing = _find_existing_reply(
        client,
        idempotency_key=key,
        provider_message_id=provider_message_id,
    )
    if existing:
        result = _result_from_reply(client, existing)
        if existing.get("handled_status") in TERMINAL_REPLY_STATUSES:
            return result
        return handle_caterer_reply(
            client,
            existing["id"],
            actor_name=actor_name,
            provider=provider,
        )

    row = (
        client.table("caterer_reply_intake")
        .insert(
            {
                "communication_id": _blank_to_none(communication_id),
                "order_run_id": order_run_id,
                "caterer_id": caterer_id,
                "provider": intake_provider,
                "provider_thread_id": _blank_to_none(provider_thread_id),
                "provider_message_id": _blank_to_none(provider_message_id),
                "in_reply_to_message_id": _blank_to_none(in_reply_to_message_id),
                "reference_message_ids": reference_message_ids or [],
                "from_email": _blank_to_none(from_email),
                "subject": _blank_to_none(subject),
                "raw_body": raw_body,
                "received_at": _blank_to_none(received_at) or _utc_now_iso(),
                "metadata": {
                    "idempotency_key": key,
                    "intake_source": intake_provider,
                },
            }
        )
        .execute()
        .data[0]
    )
    _insert_audit_log(
        client,
        order_run_id=order_run_id,
        actor_name=actor_name,
        action="caterer_reply_received",
        entity_type="caterer_reply",
        entity_id=row["id"],
        reason="Caterer reply received for handling.",
        after_state=_audit_reply_state(row),
    )
    return handle_caterer_reply(client, row["id"], actor_name=actor_name, provider=provider)


def handle_caterer_reply(
    client: Client,
    caterer_reply_id: str,
    *,
    actor_name: str | None = None,
    provider: LLMProvider | None = None,
) -> dict[str, Any]:
    """Parse and either auto-handle a clean confirmation or escalate the reply."""
    actor_name = (actor_name or "").strip() or DEFAULT_ACTOR
    reply = _select_one(
        client,
        "caterer_reply_intake",
        _required("caterer_reply_id", caterer_reply_id),
    )
    if reply.get("handled_status") in TERMINAL_REPLY_STATUSES:
        return _result_from_reply(client, reply)

    order_run_id = _required("order_run_id", str(reply.get("order_run_id") or ""))
    caterer_id = _required("caterer_id", str(reply.get("caterer_id") or ""))
    order_run = _select_one(client, "order_runs", order_run_id)
    parsed_ai = _ensure_ai_interpretation(client, reply, provider=provider)
    parsed_output = _json_object(parsed_ai.get("parsed_output"))
    parsed_intent = INTENT_TO_DB.get(str(parsed_output.get("intent") or "ambiguous"), "unknown")
    confidence = _optional_float(parsed_ai.get("confidence"))
    deterministic_block_reason: str | None = None

    if _is_clean_confirmation(parsed_output, confidence, _auto_handle_threshold(client)):
        summary = _clean_summary(parsed_output.get("summary") or "Caterer confirmed the order.")
        updated = _update_reply(
            client,
            reply["id"],
            {
                "parsed_intent": parsed_intent,
                "handled_status": "auto_handled",
                "confidence": confidence,
                "handled_at": _utc_now_iso(),
                "handling_summary": summary,
                "metadata": {
                    **(reply.get("metadata") or {}),
                    "ai_interpretation_id": parsed_ai["id"],
                },
            },
        )
        return _result_from_reply(client, updated)

    if _is_revision_candidate(parsed_output, parsed_ai, confidence, _auto_handle_threshold(client)):
        try:
            revision = _apply_safe_reply_revision(
                client,
                reply=reply,
                order_run=order_run,
                caterer_id=caterer_id,
                parsed_ai=parsed_ai,
                parsed_output=parsed_output,
                actor_name=actor_name,
            )
        except (AutoRevisionBlocked, KeyError, AttributeError, ValueError) as exc:
            deterministic_block_reason = str(exc)
        else:
            summary = _clean_summary(
                parsed_output.get("summary") or "Caterer item substitution was safely applied."
            )
            updated = _update_reply(
                client,
                reply["id"],
                {
                    "parsed_intent": parsed_intent,
                    "handled_status": "auto_adjusted",
                    "confidence": confidence,
                    "handled_at": _utc_now_iso(),
                    "handling_summary": summary,
                    "metadata": {
                        **_metadata_without_escalation(reply),
                        "ai_interpretation_id": parsed_ai["id"],
                        "revised_order_run_id": revision["revised_order_run_id"],
                        "revised_communication_id": revision["communication_id"],
                        "replacement": revision["replacement"],
                    },
                },
            )
            _resolve_existing_reply_exception(
                client,
                reply_id=reply["id"],
                resolution_note="Resolved automatically after deterministic order revision.",
            )
            return _result_from_reply(client, updated)

    escalation_output = {
        **parsed_output,
        "_deterministic_block_reason": deterministic_block_reason,
    }
    exception = _create_reply_exception_once(
        client,
        reply=reply,
        order_run=order_run,
        caterer_id=caterer_id,
        parsed_ai=parsed_ai,
        parsed_output=escalation_output,
        parsed_intent=parsed_intent,
        actor_name=actor_name,
    )
    summary = _clean_summary(parsed_output.get("summary") or "Caterer reply requires human review.")
    updated = _update_reply(
        client,
        reply["id"],
        {
            "parsed_intent": parsed_intent,
            "handled_status": "escalated",
            "confidence": confidence,
            "handled_at": _utc_now_iso(),
            "handling_summary": summary,
            "metadata": {
                **(reply.get("metadata") or {}),
                "ai_interpretation_id": parsed_ai["id"],
                "autopilot_exception_id": exception["id"],
                "deterministic_block_reason": deterministic_block_reason,
            },
        },
    )
    return _result_from_reply(client, updated, exception=exception)


class AutoRevisionBlocked(ValueError):
    """Raised when a caterer reply cannot be revised deterministically."""


def _ensure_ai_interpretation(
    client: Client,
    reply: dict[str, Any],
    *,
    provider: LLMProvider | None,
) -> dict[str, Any]:
    ai_id = reply.get("ai_interpretation_id")
    if ai_id:
        return _select_one(client, "ai_interpretations", str(ai_id))
    return interpret_caterer_reply(client, reply["id"], provider=provider)


def _create_reply_exception_once(
    client: Client,
    *,
    reply: dict[str, Any],
    order_run: dict[str, Any],
    caterer_id: str,
    parsed_ai: dict[str, Any],
    parsed_output: dict[str, Any],
    parsed_intent: str,
    actor_name: str,
) -> dict[str, Any]:
    existing = _existing_exception_for_reply(client, reply["id"])
    if existing:
        return existing

    autopilot_run = _autopilot_run_for_order_run(client, str(order_run["id"]))
    severity = _exception_severity(parsed_output, parsed_ai)
    title = _exception_title(parsed_intent)
    detail = _exception_detail(parsed_output, parsed_ai)
    metadata = {
        "caterer_reply_id": reply["id"],
        "ai_interpretation_id": parsed_ai["id"],
        "parsed_output": parsed_output,
        "deterministic_block_reason": parsed_output.get("_deterministic_block_reason"),
        "reply_subject": reply.get("subject"),
        "reply_from_email": reply.get("from_email"),
        "idempotency_key": (reply.get("metadata") or {}).get("idempotency_key"),
    }
    row = (
        client.table("autopilot_exceptions")
        .insert(
            {
                "autopilot_run_id": autopilot_run.get("id") if autopilot_run else None,
                "service_week_start": order_run["service_week_start"],
                "severity": severity,
                "category": "caterer_reply",
                "title": title,
                "detail": detail,
                "recommended_action": _recommended_action(parsed_intent, severity),
                "ai_confidence": _optional_float(parsed_ai.get("confidence")),
                "caterer_id": caterer_id,
                "order_run_id": order_run["id"],
                "metadata": metadata,
            }
        )
        .execute()
        .data[0]
    )
    _insert_audit_log(
        client,
        order_run_id=order_run["id"],
        actor_name=actor_name,
        action="autopilot_exception_created",
        entity_type="autopilot_exception",
        entity_id=row["id"],
        reason=title,
        before_state={},
        after_state=row,
    )
    return row


def _is_clean_confirmation(
    parsed_output: dict[str, Any],
    confidence: float | None,
    threshold: float,
) -> bool:
    return (
        parsed_output.get("intent") == "confirmed"
        and (confidence or 0.0) >= threshold
        and parsed_output.get("needs_human_review") is False
        and not parsed_output.get("unavailable_items")
        and not parsed_output.get("proposed_replacements")
        and not parsed_output.get("quantity_question")
        and not parsed_output.get("delivery_question")
        and not parsed_output.get("ingredient_or_safety_note")
    )


def _is_revision_candidate(
    parsed_output: dict[str, Any],
    parsed_ai: dict[str, Any],
    confidence: float | None,
    threshold: float,
) -> bool:
    return (
        parsed_output.get("intent") == "unavailable_item"
        and (confidence or 0.0) >= threshold
        and parsed_ai.get("needs_human_review") is not True
        and parsed_output.get("needs_human_review") is False
        and bool(parsed_output.get("unavailable_items"))
        and len(parsed_output.get("proposed_replacements") or []) <= 1
        and not parsed_output.get("quantity_question")
        and not parsed_output.get("delivery_question")
        and not parsed_output.get("ingredient_or_safety_note")
    )


def _apply_safe_reply_revision(
    client: Client,
    *,
    reply: dict[str, Any],
    order_run: dict[str, Any],
    caterer_id: str,
    parsed_ai: dict[str, Any],
    parsed_output: dict[str, Any],
    actor_name: str,
) -> dict[str, Any]:
    unavailable_items = [str(item) for item in parsed_output.get("unavailable_items") or []]
    replacements = [str(item) for item in parsed_output.get("proposed_replacements") or []]
    if len(unavailable_items) != 1 or len(replacements) > 1:
        raise AutoRevisionBlocked(
            "Exactly one unavailable item and at most one replacement are required."
        )
    if order_run.get("status") != "approved" or int(order_run.get("issue_count") or 0) != 0:
        raise AutoRevisionBlocked("Only approved, issue-free order runs can be revised.")

    prior_issues = _select(client, "order_allocation_issues", "*", order_run_id=order_run["id"])
    if prior_issues:
        raise AutoRevisionBlocked("Order run already has allocation issues.")

    context = _revision_context(
        client,
        order_run=order_run,
        caterer_id=caterer_id,
        unavailable_item=unavailable_items[0],
        replacement_item=replacements[0] if replacements else None,
    )
    _validate_replacement_for_allocations(context)
    revised_run = _existing_revised_order_run(client, reply=reply, context=context)
    if revised_run is None:
        revised_run = _insert_revised_order_run(
            client,
            order_run=order_run,
            reply=reply,
            parsed_ai=parsed_ai,
            parsed_output=parsed_output,
            context=context,
            actor_name=actor_name,
        )
        _copy_revised_allocations(client, context=context, revised_order_run_id=revised_run["id"])
        _copy_revised_order_lines(client, context=context, revised_order_run_id=revised_run["id"])
    if not _has_revision_audit(client, revised_run["id"]):
        _insert_audit_log(
            client,
            order_run_id=revised_run["id"],
            actor_name=actor_name,
            action="order_run_revised",
            entity_type="order_run",
            entity_id=revised_run["id"],
            reason="Autopilot safely revised an approved order run from a caterer reply.",
            before_state={
                "parent_order_run_id": order_run["id"],
                "caterer_reply_id": reply["id"],
                "affected_order_lines": [row.get("id") for row in context["affected_lines"]],
                "from_variant_id": context["from_variant"]["id"],
            },
            after_state={
                "revised_order_run_id": revised_run["id"],
                "to_variant_id": context["to_variant"]["id"],
                "affected_allocation_count": len(context["affected_allocations"]),
                "affected_caterer_id": context["caterer_id"],
            },
        )
    export = record_communication_export(
        client,
        order_run_id=revised_run["id"],
        caterer_id=caterer_id,
        actor_name=actor_name,
        reason="Autopilot prepared revised caterer email snapshot for affected caterer only.",
    )
    if export["communication"].get("status") != "sent":
        send = send_caterer_emails(
            client,
            order_run_id=revised_run["id"],
            communication_ids=[export["communication"]["id"]],
            actor_name=actor_name,
            reason="Autopilot sent revised test-routed caterer email snapshot.",
        )
        if send["failed"]:
            raise AutoRevisionBlocked("Revised caterer email send failed.")
    return {
        "revised_order_run_id": revised_run["id"],
        "communication_id": export["communication"]["id"],
        "replacement": {
            "unavailable_item": unavailable_items[0],
            "replacement_item": context["replacement_item"],
            "from_variant_id": context["from_variant"]["id"],
            "to_variant_id": context["to_variant"]["id"],
            "selection_source": context["replacement_selection"]["source"],
            "selection_score": context["replacement_selection"].get("score"),
            "affected_session_ids": sorted(context["affected_session_ids"]),
            "affected_allocation_count": len(context["affected_allocations"]),
        },
    }


def _existing_revised_order_run(
    client: Client,
    *,
    reply: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any] | None:
    matches = []
    for run in _select(client, "order_runs", "*"):
        snapshot = run.get("input_snapshot") or {}
        if (
            run.get("algorithm_version") == REVISION_ALGORITHM_VERSION
            and snapshot.get("caterer_reply_id") == reply["id"]
        ):
            matches.append(run)
    if len(matches) > 1:
        raise AutoRevisionBlocked("Multiple revised order runs exist for this caterer reply.")
    if not matches:
        return None
    revision = (matches[0].get("input_snapshot") or {}).get("reply_revision") or {}
    if (
        revision.get("from_variant_id") != context["from_variant"]["id"]
        or revision.get("to_variant_id") != context["to_variant"]["id"]
    ):
        raise AutoRevisionBlocked("Existing reply revision does not match the current selection.")
    return matches[0]


def _has_revision_audit(client: Client, order_run_id: str) -> bool:
    return any(
        row.get("action") == "order_run_revised"
        and row.get("entity_type") == "order_run"
        and row.get("entity_id") == order_run_id
        for row in _select(client, "audit_log", "*", order_run_id=order_run_id)
    )


def _revision_context(
    client: Client,
    *,
    order_run: dict[str, Any],
    caterer_id: str,
    unavailable_item: str,
    replacement_item: str | None,
) -> dict[str, Any]:
    order_run_id = str(order_run["id"])
    sessions = {row["id"]: row for row in _select(client, "sessions")}
    dishes = {row["id"]: row for row in _select(client, "dishes")}
    variants = {row["id"]: row for row in _select(client, "dish_variants")}
    lines = _select(client, "order_lines", "*", order_run_id=order_run_id)
    allocations = _select(client, "order_allocations", "*", order_run_id=order_run_id)

    ranked_lines = [
        (
            line,
            _item_match_rank(
                unavailable_item,
                line=line,
                variant=variants.get(line.get("dish_variant_id"), {}),
                dish=dishes.get(line.get("dish_id"), {}),
            ),
        )
        for line in lines
        if sessions.get(line.get("session_id"), {}).get("caterer_id") == caterer_id
    ]
    best_match_rank = max((rank for _, rank in ranked_lines), default=0)
    affected_lines = [line for line, rank in ranked_lines if rank == best_match_rank and rank > 0]
    if not affected_lines:
        raise AutoRevisionBlocked("Unavailable item did not match any sent order line.")

    from_variant_ids = {line.get("dish_variant_id") for line in affected_lines}
    if len(from_variant_ids) != 1:
        raise AutoRevisionBlocked("Unavailable item matched multiple variants.")
    from_variant_id = str(next(iter(from_variant_ids)))
    from_variant = variants.get(from_variant_id)
    if not from_variant:
        raise AutoRevisionBlocked("Unavailable variant could not be resolved.")

    affected_session_ids = {line["session_id"] for line in affected_lines}
    affected_allocations = [
        row
        for row in allocations
        if row.get("status") == "allocated"
        and row.get("dish_variant_id") == from_variant_id
        and row.get("session_id") in affected_session_ids
    ]
    if not affected_allocations:
        raise AutoRevisionBlocked("No affected student allocations were found.")

    context: dict[str, Any] = {
        "order_run_id": order_run_id,
        "caterer_id": caterer_id,
        "sessions": sessions,
        "dishes": dishes,
        "variants": variants,
        "lines": lines,
        "allocations": allocations,
        "affected_lines": affected_lines,
        "affected_session_ids": affected_session_ids,
        "affected_allocations": affected_allocations,
        "from_variant": from_variant,
        "unavailable_item": unavailable_item,
    }
    if replacement_item:
        _set_explicit_replacement(context, replacement_item)
    else:
        _set_inferred_replacement(
            client,
            context=context,
            service_week_start=str(order_run["service_week_start"]),
        )
    return context


def _set_explicit_replacement(context: dict[str, Any], replacement_item: str) -> None:
    caterer_id = context["caterer_id"]
    dishes = context["dishes"]
    ranked_matches = [
        (
            variant,
            _variant_match_rank(
                replacement_item,
                variant,
                dishes.get(variant.get("dish_id"), {}),
            ),
        )
        for variant in context["variants"].values()
        if dishes.get(variant.get("dish_id"), {}).get("caterer_id") == caterer_id
    ]
    best_match_rank = max((rank for _, rank in ranked_matches), default=0)
    replacement_matches = [
        variant for variant, rank in ranked_matches if rank == best_match_rank and rank > 0
    ]
    replacement_matches = _dedupe_by_id(replacement_matches)
    if len(replacement_matches) != 1:
        raise AutoRevisionBlocked("Replacement item did not match exactly one known dish variant.")
    to_variant = replacement_matches[0]
    to_dish = dishes.get(to_variant.get("dish_id"), {})
    _validate_candidate_variant(
        to_variant,
        from_variant_id=context["from_variant"]["id"],
        source_dish_id=None,
    )
    context.update(
        {
            "to_variant": to_variant,
            "to_dish": to_dish,
            "replacement_item": replacement_item,
            "replacement_selection": {
                "source": "caterer_proposed",
                "score": None,
                "candidate_scores": [],
            },
        }
    )


def _set_inferred_replacement(
    client: Client,
    *,
    context: dict[str, Any],
    service_week_start: str,
) -> None:
    service_date = date.fromisoformat(service_week_start)
    scoring = _reply_scoring_context(
        client,
        service_date,
        student_ids={
            str(allocation["student_id"])
            for allocation in context["affected_allocations"]
            if allocation.get("student_id")
        },
    )
    candidate_scores: list[dict[str, Any]] = []
    valid_candidates: list[dict[str, Any]] = []
    source_dish_id = context["from_variant"].get("dish_id")
    for variant in context["variants"].values():
        dish = context["dishes"].get(variant.get("dish_id"), {})
        if dish.get("caterer_id") != context["caterer_id"]:
            continue
        try:
            _validate_candidate_variant(
                variant,
                from_variant_id=context["from_variant"]["id"],
                source_dish_id=str(source_dish_id or ""),
            )
        except AutoRevisionBlocked:
            continue
        option = _dish_option_from_variant(variant, dish)
        safety_failures = _replacement_safety_failures(option, context["affected_allocations"])
        if safety_failures:
            continue
        score_data = _aggregate_replacement_score(
            context=context,
            variant=variant,
            dish=dish,
            scoring=scoring,
        )
        candidate_score = {
            "variant_id": variant["id"],
            "display_name": option.name,
            **score_data,
        }
        candidate_scores.append(candidate_score)
        valid_candidates.append(
            {
                "variant": variant,
                "dish": dish,
                "option": option,
                "score_data": score_data,
            }
        )

    if not valid_candidates:
        raise AutoRevisionBlocked("No safe reviewed same-caterer replacement candidate was found.")

    selected = max(
        valid_candidates,
        key=lambda row: (
            row["score_data"]["score"],
            row["score_data"]["novelty"],
            -abs(row["score_data"]["recent_repetition"]),
            row["option"].name,
            row["variant"]["id"],
        ),
    )
    context.update(
        {
            "to_variant": selected["variant"],
            "to_dish": selected["dish"],
            "replacement_item": selected["option"].name,
            "replacement_selection": {
                "source": "meal_fit_inferred",
                "score": selected["score_data"]["score"],
                "novelty": selected["score_data"]["novelty"],
                "recent_repetition": selected["score_data"]["recent_repetition"],
                "candidate_scores": sorted(
                    candidate_scores,
                    key=lambda row: (-row["score"], row["display_name"], row["variant_id"]),
                ),
                "safety_policy": "safe_for_all_affected_allocations",
                "candidate_pool": "reviewed_available_same_caterer_excluding_unavailable_dish",
            },
        }
    )


def _validate_candidate_variant(
    variant: dict[str, Any],
    *,
    from_variant_id: str,
    source_dish_id: str | None,
) -> None:
    if variant["id"] == from_variant_id:
        raise AutoRevisionBlocked("Replacement item matches the unavailable item.")
    if source_dish_id and variant.get("dish_id") == source_dish_id:
        raise AutoRevisionBlocked("Inferred replacement cannot use the unavailable dish.")
    if not variant.get("is_available"):
        raise AutoRevisionBlocked("Replacement variant is not marked available.")
    if variant.get("ingredient_flags_source") != "operator_reviewed":
        raise AutoRevisionBlocked("Replacement variant has not been operator reviewed.")


def _validate_replacement_for_allocations(context: dict[str, Any]) -> None:
    to_variant = context["to_variant"]
    option = _dish_option_from_variant(to_variant, context["to_dish"])
    failures = _replacement_safety_failures(option, context["affected_allocations"])
    if failures:
        raise AutoRevisionBlocked(f"Replacement is unsafe for affected allocations: {failures}")


def _replacement_safety_failures(
    option: DishOption,
    affected_allocations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    failures: list[dict[str, Any]] = []
    for allocation in affected_allocations:
        reasons = dish_failure_reasons(option, set(allocation.get("dietary_tag_codes") or []))
        if reasons:
            failures.append(
                {
                    "allocation_id": allocation.get("id"),
                    "student_id": allocation.get("student_id"),
                    "reasons": reasons,
                }
            )
    return failures


def _reply_scoring_context(
    client: Client,
    service_week_start: date,
    *,
    student_ids: set[str],
) -> dict[str, Any]:
    config = _active_scoring_config(client)
    active_tags = {
        row["code"]
        for row in _select_optional(client, "preference_tags", "code, is_active")
        if row.get("is_active")
    }
    tags_by_variant: dict[str, list[DishTag]] = defaultdict(list)
    for row in _select_optional(
        client,
        "dish_variant_tags",
        "dish_variant_id, tag_code, tag_source, confidence",
    ):
        tag_code = str(row.get("tag_code") or "")
        if not tag_code or (active_tags and tag_code not in active_tags):
            continue
        confidence = _as_float(row.get("confidence"), 1.0)
        if (
            row.get("tag_source") == "ai_suggested"
            and confidence < config.decay_config.minimum_ai_tag_confidence
        ):
            continue
        tags_by_variant[row["dish_variant_id"]].append(DishTag(tag_code, clamp(confidence)))

    recent_variant_ids, recent_tag_codes = _load_recent_reply_allocations(
        client,
        service_week_start=service_week_start,
        tags_by_variant=tags_by_variant,
        config=config,
    )
    return {
        "config": config,
        "tags_by_variant": tags_by_variant,
        "population_prior": _load_population_prior(client),
        "profiles_by_student": _load_reply_profiles(
            client,
            service_week_start=service_week_start,
            student_ids=student_ids,
            recent_variant_ids=recent_variant_ids,
            recent_tag_codes=recent_tag_codes,
        ),
        "caterer_quality_penalties": _load_reply_caterer_quality_penalties(client),
        "leftover_penalties": _load_reply_leftover_penalties(client),
    }


def _active_scoring_config(client: Client) -> MealFitScoringConfig:
    rows = [
        row
        for row in _select_optional(
            client, "meal_fit_scoring_versions", "version, weights, decay_config, is_active"
        )
        if row.get("is_active")
    ]
    rows.sort(key=lambda row: (row.get("version") != DEFAULT_VERSION, row.get("version", "")))
    return config_from_row(rows[0] if rows else None)


def _aggregate_replacement_score(
    *,
    context: dict[str, Any],
    variant: dict[str, Any],
    dish: dict[str, Any],
    scoring: dict[str, Any],
) -> dict[str, Any]:
    config: MealFitScoringConfig = scoring["config"]
    tags = list(scoring["tags_by_variant"].get(variant["id"], []))
    breakdowns = []
    for allocation in context["affected_allocations"]:
        profile = scoring["profiles_by_student"].get(
            allocation.get("student_id"),
            StudentPreferenceProfile(),
        )
        breakdowns.append(
            score_candidate(
                profile,
                CandidateContext(
                    variant_id=variant["id"],
                    caterer_id=context["caterer_id"],
                    tags=tags,
                    population_prior=scoring["population_prior"].get(variant["id"], 0.0),
                    caterer_quality_penalty=scoring["caterer_quality_penalties"].get(
                        context["caterer_id"], 0.0
                    ),
                    leftover_penalty=scoring["leftover_penalties"].get(context["caterer_id"], 0.0),
                ),
                config,
            )
        )
    average_score = sum(item.score for item in breakdowns) / max(1, len(breakdowns))
    average_novelty = sum(item.novelty for item in breakdowns) / max(1, len(breakdowns))
    average_repetition = sum(item.recent_repetition for item in breakdowns) / max(
        1, len(breakdowns)
    )
    return {
        "score": round(average_score, 4),
        "novelty": round(average_novelty, 4),
        "recent_repetition": round(average_repetition, 4),
        "positive_factors": _merge_score_factors(item.positive_factors for item in breakdowns),
        "negative_factors": _merge_score_factors(item.negative_factors for item in breakdowns),
        "tag_codes": sorted(tag.tag_code for tag in tags),
        "dish_id": dish.get("id"),
    }


def _merge_score_factors(items: Any) -> list[dict[str, Any]]:
    values: dict[str, list[float]] = defaultdict(list)
    for factors in items:
        for factor in factors:
            values[str(factor["factor"])].append(_as_float(factor["value"]))
    merged = [
        {"factor": factor, "value": round(sum(scores) / len(scores), 4)}
        for factor, scores in values.items()
        if scores
    ]
    return sorted(merged, key=lambda row: (-abs(row["value"]), row["factor"]))[:5]


def _load_population_prior(client: Client) -> dict[str, float]:
    values: dict[str, list[float]] = defaultdict(list)
    for row in _select_optional(client, "student_meal_feedback", "dish_variant_id, rating, liked"):
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


def _load_reply_profiles(
    client: Client,
    *,
    service_week_start: date,
    student_ids: set[str],
    recent_variant_ids: dict[str, set[str]],
    recent_tag_codes: dict[str, set[str]],
) -> dict[str, StudentPreferenceProfile]:
    mutable_signals: dict[str, dict[str, PreferenceSignal]] = defaultdict(dict)
    for row in _select_optional_for_ids(
        client,
        "student_preference_signals",
        "student_id, tag_code, affinity_score, confidence, feedback_count",
        key="student_id",
        values=student_ids,
    ):
        mutable_signals[row["student_id"]][row["tag_code"]] = PreferenceSignal(
            affinity_score=_as_float(row["affinity_score"]),
            confidence=_as_float(row["confidence"]),
            feedback_count=int(row.get("feedback_count") or 0),
        )

    direct_scores: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for row in _select_optional_for_ids(
        client,
        "student_meal_feedback",
        "student_id, dish_variant_id, rating, liked",
        key="student_id",
        values=student_ids,
    ):
        if not row.get("dish_variant_id"):
            continue
        score = _feedback_score(row)
        if score is not None:
            direct_scores[row["student_id"]][row["dish_variant_id"]].append(score)

    fit_debt_by_student = {
        row["student_id"]: _as_float(row["fit_debt_score"])
        for row in _select_optional_for_ids(
            client,
            "student_fit_debt",
            "student_id, service_week_start, fit_debt_score",
            key="student_id",
            values=student_ids,
        )
        if row.get("service_week_start") == service_week_start.isoformat()
    }
    all_student_ids = (
        set(mutable_signals)
        | set(direct_scores)
        | set(recent_variant_ids)
        | set(recent_tag_codes)
        | set(fit_debt_by_student)
    )
    return {
        student_id: StudentPreferenceProfile(
            tag_signals=mutable_signals.get(student_id, {}),
            direct_variant_scores={
                variant_id: clamp(sum(scores) / len(scores))
                for variant_id, scores in direct_scores.get(student_id, {}).items()
            },
            recent_variant_ids=recent_variant_ids.get(student_id, set()),
            recent_tag_codes=recent_tag_codes.get(student_id, set()),
            fit_debt_score=fit_debt_by_student.get(student_id, 0.0),
        )
        for student_id in all_student_ids
    }


def _load_recent_reply_allocations(
    client: Client,
    *,
    service_week_start: date,
    tags_by_variant: dict[str, list[DishTag]],
    config: MealFitScoringConfig,
) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    window_start = service_week_start - timedelta(
        weeks=config.decay_config.recent_repetition_window_weeks
    )
    recent_run_ids = {
        row["id"]
        for row in _select_optional(client, "order_runs", "id, service_week_start, status")
        if row.get("status") in {"generated", "approved", "superseded"}
        and window_start <= date.fromisoformat(str(row["service_week_start"])) < service_week_start
    }
    recent_variant_ids: dict[str, set[str]] = defaultdict(set)
    recent_tag_codes: dict[str, set[str]] = defaultdict(set)
    tags_by_variant_code = {
        variant_id: {tag.tag_code for tag in tags} for variant_id, tags in tags_by_variant.items()
    }
    for row in _select_optional(
        client, "order_allocations", "order_run_id, student_id, dish_variant_id, status"
    ):
        if row.get("order_run_id") not in recent_run_ids or row.get("status") != "allocated":
            continue
        variant_id = row.get("dish_variant_id")
        if not variant_id:
            continue
        recent_variant_ids[row["student_id"]].add(variant_id)
        recent_tag_codes[row["student_id"]].update(tags_by_variant_code.get(variant_id, set()))
    return recent_variant_ids, recent_tag_codes


def _load_reply_caterer_quality_penalties(client: Client) -> dict[str, float]:
    severity_scores = {"info": 0.05, "review": 0.25, "serious": 0.65}
    values: dict[str, list[float]] = defaultdict(list)
    for row in _select_optional(
        client,
        "caterer_quality_events",
        "caterer_id, severity, event_type",
    ):
        value = severity_scores.get(row.get("severity"), 0.0)
        if row.get("event_type") == "positive_feedback":
            value = -0.1
        values[row["caterer_id"]].append(value)
    return {
        caterer_id: clamp(sum(items) / max(1, len(items)), 0.0, 1.0)
        for caterer_id, items in values.items()
    }


def _load_reply_leftover_penalties(client: Client) -> dict[str, float]:
    leftover_scores = {"none": 0.0, "low": 0.1, "moderate": 0.35, "high": 0.7, "unknown": 0.0}
    values: dict[str, list[float]] = defaultdict(list)
    for row in _select_optional(
        client,
        "session_catering_feedback",
        "session_id, caterer_id, leftover_level",
    ):
        caterer_id = row.get("caterer_id")
        if not caterer_id:
            continue
        values[caterer_id].append(leftover_scores.get(row.get("leftover_level"), 0.0))
    return {
        caterer_id: clamp(sum(items) / max(1, len(items)), 0.0, 1.0)
        for caterer_id, items in values.items()
    }


def _feedback_score(row: dict[str, Any]) -> float | None:
    if row.get("rating") is not None:
        return clamp((_as_float(row["rating"]) - 3.0) / 2.0)
    if row.get("liked") is True:
        return 0.5
    if row.get("liked") is False:
        return -0.5
    return None


def _insert_revised_order_run(
    client: Client,
    *,
    order_run: dict[str, Any],
    reply: dict[str, Any],
    parsed_ai: dict[str, Any],
    parsed_output: dict[str, Any],
    context: dict[str, Any],
    actor_name: str,
) -> dict[str, Any]:
    now = _utc_now_iso()
    payload: dict[str, Any] = {
        "service_week_start": order_run["service_week_start"],
        "status": "approved",
        "algorithm_version": REVISION_ALGORITHM_VERSION,
        "generated_by": actor_name,
        "input_snapshot": {
            **(order_run.get("input_snapshot") or {}),
            "parent_order_run_id": order_run["id"],
            "caterer_reply_id": reply["id"],
            "ai_interpretation_id": parsed_ai["id"],
            "reply_revision": {
                "source": "caterer_reply_auto_adjustment",
                "unavailable_item": context["unavailable_item"],
                "replacement_item": context["replacement_item"],
                "from_variant_id": context["from_variant"]["id"],
                "to_variant_id": context["to_variant"]["id"],
                "replacement_selection": context["replacement_selection"],
                "affected_line_ids": [row.get("id") for row in context["affected_lines"]],
                "affected_allocation_ids": [
                    row.get("id") for row in context["affected_allocations"]
                ],
                "pricing_policy": (
                    "Replacement order lines preserve the unavailable source line unit price "
                    "unless the same replacement variant already has a line in that session."
                ),
                "parsed_output": parsed_output,
                "actor_name": actor_name,
                "recorded_at": now,
            },
        },
        "issue_count": 0,
        "approved_at": now,
        "approved_by": actor_name,
        "approval_note": "Autopilot approved deterministic caterer reply revision.",
    }
    if order_run.get("service_week_end") is not None:
        payload["service_week_end"] = order_run["service_week_end"]
    return client.table("order_runs").insert(payload).execute().data[0]


def _copy_revised_allocations(
    client: Client,
    *,
    context: dict[str, Any],
    revised_order_run_id: str,
) -> None:
    affected_ids = {row.get("id") for row in context["affected_allocations"]}
    to_variant = context["to_variant"]
    to_dish = context["to_dish"]
    for allocation in context["allocations"]:
        payload = _copy_row_without_identity(allocation)
        payload["order_run_id"] = revised_order_run_id
        if allocation.get("id") in affected_ids:
            payload["dish_id"] = to_dish["id"]
            payload["dish_variant_id"] = to_variant["id"]
        client.table("order_allocations").insert(payload).execute()


def _copy_revised_order_lines(
    client: Client,
    *,
    context: dict[str, Any],
    revised_order_run_id: str,
) -> None:
    affected_line_ids = {row.get("id") for row in context["affected_lines"]}
    affected_by_session = {row["session_id"]: row for row in context["affected_lines"]}
    affected_allocation_counts: dict[str, int] = {}
    for allocation in context["affected_allocations"]:
        affected_allocation_counts[allocation["session_id"]] = (
            affected_allocation_counts.get(allocation["session_id"], 0) + 1
        )

    revised_lines: dict[tuple[str, str], dict[str, Any]] = {}
    for line in context["lines"]:
        if line.get("id") in affected_line_ids:
            remaining = int(line["quantity"]) - affected_allocation_counts.get(
                line["session_id"], 0
            )
            if remaining > 0:
                payload = _copy_row_without_identity(line)
                payload["order_run_id"] = revised_order_run_id
                payload["quantity"] = remaining
                payload["line_total_cents"] = remaining * int(payload["unit_price_cents"])
                revised_lines[(payload["session_id"], payload["dish_variant_id"])] = payload
            continue

        payload = _copy_row_without_identity(line)
        payload["order_run_id"] = revised_order_run_id
        revised_lines[(payload["session_id"], payload["dish_variant_id"])] = payload

    for session_id, count in affected_allocation_counts.items():
        source_line = affected_by_session[session_id]
        key = (session_id, context["to_variant"]["id"])
        if key in revised_lines:
            revised_lines[key]["quantity"] = int(revised_lines[key]["quantity"]) + count
            revised_lines[key]["line_total_cents"] = int(revised_lines[key]["quantity"]) * int(
                revised_lines[key]["unit_price_cents"]
            )
            continue
        unit_price = int(source_line["unit_price_cents"])
        revised_lines[key] = {
            "order_run_id": revised_order_run_id,
            "session_id": session_id,
            "dish_id": context["to_dish"]["id"],
            "dish_variant_id": context["to_variant"]["id"],
            "quantity": count,
            "unit_price_cents": unit_price,
            "gst_inclusive": source_line["gst_inclusive"],
            "line_total_cents": count * unit_price,
        }

    for line in sorted(revised_lines.values(), key=lambda row: (row["session_id"], row["dish_id"])):
        if int(line.get("quantity") or 0) <= 0:
            raise AutoRevisionBlocked("Revision would create an invalid order line quantity.")
        client.table("order_lines").insert(line).execute()


def _copy_row_without_identity(row: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value for key, value in row.items() if key not in {"id", "created_at", "updated_at"}
    }


def _dish_option_from_variant(variant: dict[str, Any], dish: dict[str, Any]) -> DishOption:
    return DishOption(
        id=str(variant["id"]),
        name=_variant_display_name(dish.get("name") or "", variant.get("name") or ""),
        dish_id=str(dish.get("id") or variant.get("dish_id") or ""),
        is_gluten_free=bool(variant.get("is_gluten_free")),
        is_dairy_free=bool(variant.get("is_dairy_free")),
        is_nut_free=bool(variant.get("is_nut_free")),
        is_vegetarian_option=bool(variant.get("is_vegetarian_option")),
        is_halal_inferred=bool(variant.get("is_halal_inferred")),
        has_no_declared_tags=bool(variant.get("has_no_declared_tags")),
        contains_beef=bool(variant.get("contains_beef")),
        contains_pork=bool(variant.get("contains_pork")),
        contains_red_meat=bool(variant.get("contains_red_meat")),
        contains_fish=bool(variant.get("contains_fish")),
        contains_shellfish=bool(variant.get("contains_shellfish")),
        ingredient_flags_source=str(variant.get("ingredient_flags_source") or "unreviewed"),
    )


def _item_match_rank(
    value: str,
    *,
    line: dict[str, Any],
    variant: dict[str, Any],
    dish: dict[str, Any],
) -> int:
    normalized = _normalize_name(value)
    display_name = _normalize_name(
        _variant_display_name(str(dish.get("name") or ""), str(variant.get("name") or ""))
    )
    exact_display_names = {
        str(line.get("variant_name") or ""),
        str(line.get("dish_name") or ""),
    }
    if normalized == display_name or _same_name_tokens(normalized, display_name):
        return 4
    if any(
        normalized == _normalize_name(candidate) for candidate in exact_display_names if candidate
    ):
        return 4
    if normalized == _normalize_name(str(dish.get("name") or "")):
        return 3
    variant_name = _normalize_name(str(variant.get("name") or ""))
    if variant_name != "standard" and normalized == variant_name:
        return 2
    if _names_match(normalized, display_name):
        return 1
    return 0


def _variant_match_rank(value: str, variant: dict[str, Any], dish: dict[str, Any]) -> int:
    normalized = _normalize_name(value)
    display_name = _normalize_name(
        _variant_display_name(str(dish.get("name") or ""), str(variant.get("name") or ""))
    )
    if normalized == display_name or _same_name_tokens(normalized, display_name):
        return 4
    if normalized == _normalize_name(str(dish.get("name") or "")):
        return 3
    variant_name = _normalize_name(str(variant.get("name") or ""))
    if variant_name != "standard" and normalized == variant_name:
        return 2
    if _names_match(normalized, display_name):
        return 1
    return 0


def _same_name_tokens(left: str, right: str) -> bool:
    return (
        bool(left and right)
        and left.split() != right.split()
        and sorted(left.split()) == sorted(right.split())
    )


def _names_match(left: str, right: str) -> bool:
    if not left or not right:
        return False
    return left == right or left in right or right in left


def _normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _variant_display_name(dish_name: str, variant_name: str) -> str:
    return dish_name if variant_name == "Standard" else f"{dish_name} - {variant_name}"


def _dedupe_by_id(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for row in rows:
        row_id = str(row.get("id") or "")
        if not row_id or row_id in seen:
            continue
        seen.add(row_id)
        deduped.append(row)
    return deduped


def _exception_severity(parsed_output: dict[str, Any], parsed_ai: dict[str, Any]) -> str:
    intent = parsed_output.get("intent")
    if (
        intent in {"unavailable_item", "quantity_question"}
        or parsed_output.get("unavailable_items")
        or parsed_output.get("proposed_replacements")
        or parsed_output.get("quantity_question")
        or parsed_output.get("ingredient_or_safety_note")
        or parsed_ai.get("needs_human_review") is True
        or parsed_output.get("needs_human_review") is True
    ):
        return "blocked"
    return "review"


def _exception_title(parsed_intent: str) -> str:
    labels = {
        "confirmation": "Caterer reply needs review: confirmation",
        "item_unavailable": "Caterer reply needs review: item unavailable",
        "quantity_question": "Caterer reply needs review: quantity question",
        "delivery_question": "Caterer reply needs review: delivery question",
        "other": "Caterer reply needs review",
        "unknown": "Caterer reply needs review: ambiguous",
    }
    return labels.get(parsed_intent, "Caterer reply needs review")


def _exception_detail(parsed_output: dict[str, Any], parsed_ai: dict[str, Any]) -> str:
    parts = [str(parsed_output.get("summary") or "Caterer reply requires human review.")]
    if parsed_output.get("unavailable_items"):
        parts.append(f"Unavailable items: {', '.join(parsed_output['unavailable_items'])}.")
    if parsed_output.get("proposed_replacements"):
        parts.append(f"Proposed replacements: {', '.join(parsed_output['proposed_replacements'])}.")
    if parsed_output.get("quantity_question"):
        parts.append(f"Quantity question: {parsed_output['quantity_question']}")
    if parsed_output.get("delivery_question"):
        parts.append(f"Delivery question: {parsed_output['delivery_question']}")
    if parsed_output.get("ingredient_or_safety_note"):
        parts.append(f"Ingredient/safety note: {parsed_output['ingredient_or_safety_note']}")
    if parsed_output.get("_deterministic_block_reason"):
        parts.append(
            f"Deterministic revision blocked: {parsed_output['_deterministic_block_reason']}"
        )
    confidence = parsed_ai.get("confidence")
    if confidence is not None:
        parts.append(f"AI confidence: {confidence}.")
    return _clean_summary(" ".join(parts))


def _recommended_action(parsed_intent: str, severity: str) -> str:
    if parsed_intent == "item_unavailable":
        return (
            "Review the unavailable item and decide whether to contact the caterer or "
            "regenerate safely."
        )
    if parsed_intent == "quantity_question":
        return "Answer the caterer quantity question before proceeding."
    if severity == "blocked":
        return "Review the reply before making any operational change."
    return "Review the reply and mark the exception resolved when no further action is required."


def _auto_handle_threshold(client: Client) -> float:
    try:
        rows = _select(client, "meal_fit_scoring_versions", "*", is_active=True)
    except (KeyError, AttributeError):
        return DEFAULT_MINIMUM_AUTO_HANDLE_CONFIDENCE
    row = rows[0] if rows else None
    return config_from_row(row).decay_config.minimum_ai_auto_handle_confidence


def _find_existing_reply(
    client: Client,
    *,
    idempotency_key: str,
    provider_message_id: str | None,
) -> dict[str, Any] | None:
    message_id = _blank_to_none(provider_message_id)
    if message_id:
        matches = _select(client, "caterer_reply_intake", "*", provider_message_id=message_id)
        if matches:
            return matches[0]
    for row in _select(client, "caterer_reply_intake"):
        if (row.get("metadata") or {}).get("idempotency_key") == idempotency_key:
            return row
    return None


def _existing_exception_for_reply(client: Client, reply_id: str) -> dict[str, Any] | None:
    for row in _select(client, "autopilot_exceptions"):
        if (row.get("metadata") or {}).get("caterer_reply_id") == reply_id:
            return row
    return None


def _resolve_existing_reply_exception(
    client: Client,
    *,
    reply_id: str,
    resolution_note: str,
) -> None:
    exception = _existing_exception_for_reply(client, reply_id)
    if not exception or exception.get("status") != "open":
        return
    client.table("autopilot_exceptions").update(
        {
            "status": "resolved",
            "resolved_at": _utc_now_iso(),
            "resolved_note": resolution_note,
        }
    ).eq("id", exception["id"]).execute()


def _metadata_without_escalation(reply: dict[str, Any]) -> dict[str, Any]:
    metadata = dict(reply.get("metadata") or {})
    metadata.pop("autopilot_exception_id", None)
    metadata.pop("deterministic_block_reason", None)
    return metadata


def _autopilot_run_for_order_run(client: Client, order_run_id: str) -> dict[str, Any] | None:
    try:
        rows = _select(client, "autopilot_runs", "*", generated_order_run_id=order_run_id)
    except (KeyError, AttributeError):
        return None
    return rows[0] if rows else None


def _result_from_reply(
    client: Client,
    reply: dict[str, Any],
    *,
    exception: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ai_id = reply.get("ai_interpretation_id")
    if not exception:
        exception_id = (reply.get("metadata") or {}).get("autopilot_exception_id")
        if exception_id:
            try:
                exception = _select_one(client, "autopilot_exceptions", exception_id)
            except ValueError:
                exception = None
    return {
        "reply_id": reply["id"],
        "ai_interpretation_id": ai_id,
        "parsed_intent": reply.get("parsed_intent"),
        "handled_status": reply.get("handled_status"),
        "exception_id": exception.get("id") if exception else None,
        "summary": reply.get("handling_summary") or "",
        "reply": reply,
        "exception": exception,
    }


def _reply_idempotency_key(
    *,
    order_run_id: str,
    caterer_id: str,
    subject: str | None,
    raw_body: str,
    provider_message_id: str | None,
    idempotency_key: str | None,
) -> str:
    explicit = _blank_to_none(idempotency_key)
    if explicit:
        return explicit
    provider_id = _blank_to_none(provider_message_id)
    if provider_id:
        return provider_id
    payload = json.dumps(
        {
            "order_run_id": order_run_id,
            "caterer_id": caterer_id,
            "subject": _blank_to_none(subject),
            "raw_body": raw_body,
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _required(name: str, value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError(f"{name} is required.")
    return cleaned


def _blank_to_none(value: str | None) -> str | None:
    cleaned = (value or "").strip()
    return cleaned or None


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def _as_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    return float(value)


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return parsed
    return {}


def _clean_summary(value: str) -> str:
    return " ".join(str(value).split())


def _update_reply(client: Client, reply_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    rows = client.table("caterer_reply_intake").update(payload).eq("id", reply_id).execute().data
    if not rows:
        raise ValueError(f"caterer_reply_intake row {reply_id!r} does not exist.")
    return rows[0]


def _audit_reply_state(reply: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": reply.get("id"),
        "order_run_id": reply.get("order_run_id"),
        "caterer_id": reply.get("caterer_id"),
        "communication_id": reply.get("communication_id"),
        "provider": reply.get("provider"),
        "provider_message_id": reply.get("provider_message_id"),
        "subject": reply.get("subject"),
        "received_at": reply.get("received_at"),
        "metadata": reply.get("metadata") or {},
    }


def _insert_audit_log(
    client: Client,
    *,
    order_run_id: str | None,
    actor_name: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    reason: str,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return (
        client.table("audit_log")
        .insert(
            {
                "order_run_id": order_run_id,
                "actor_name": actor_name,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "reason": reason,
                "before_state": before_state or {},
                "after_state": after_state or {},
            }
        )
        .execute()
        .data[0]
    )


def _select(client: Client, table: str, columns: str = "*", **eq: Any) -> list[dict[str, Any]]:
    query = client.table(table).select(columns)
    for key, value in eq.items():
        query = query.eq(key, value)
    return query.execute().data


def _select_optional(
    client: Client,
    table: str,
    columns: str = "*",
    **eq: Any,
) -> list[dict[str, Any]]:
    try:
        return _select(client, table, columns, **eq)
    except (KeyError, AttributeError):
        return []


def _select_optional_for_ids(
    client: Client,
    table: str,
    columns: str,
    *,
    key: str,
    values: set[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for value in sorted(values):
        rows.extend(_select_optional(client, table, columns, **{key: value}))
    return rows


def _select_one(client: Client, table: str, row_id: str) -> dict[str, Any]:
    rows = _select(client, table, id=row_id)
    if not rows:
        raise ValueError(f"{table} row {row_id!r} does not exist.")
    return rows[0]
