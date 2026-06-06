"""Persisted preview, validation, and application for reply exceptions."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from padea_catering.communications import (
    record_exception_reply_communication,
    send_caterer_emails,
)
from padea_catering.llm import LLMProvider, interpret_exception_resolution
from padea_catering.ordering.rules import DishOption, dish_failure_reasons
from supabase import Client

RESOLUTION_ALGORITHM_VERSION = "operator-exception-resolution-v1"


def generate_resolution_preview(
    client: Client,
    *,
    exception_id: str,
    operator_instruction: str,
    actor_id: str,
    actor_name: str,
    idempotency_key: str,
    provider: LLMProvider | None = None,
) -> dict[str, Any]:
    """Interpret an instruction and persist a side-effect-free preview."""
    instruction = _required("operator_instruction", operator_instruction)
    actor_id = _required("actor_id", actor_id)
    actor_name = _required("actor_name", actor_name)
    key = _required("idempotency_key", idempotency_key)
    existing = _select(client, "autopilot_exception_resolutions", "*", idempotency_key=key)
    if existing:
        return existing[0]

    context = _resolution_context(client, exception_id)
    ai = interpret_exception_resolution(
        client,
        autopilot_exception_id=exception_id,
        raw_input={
            "operator_instruction": instruction,
            "exception": {
                "title": context["exception"].get("title"),
                "detail": context["exception"].get("detail"),
                "recommended_action": context["exception"].get("recommended_action"),
            },
            "caterer_reply": {
                "subject": context["reply"].get("subject"),
                "body": context["reply"].get("raw_body"),
            },
            "current_order_items": [
                {"dish_variant_id": row["id"], "display_name": row["display_name"]}
                for row in context["current_variants"].values()
            ],
            "available_reviewed_replacements": [
                {"dish_variant_id": row["id"], "display_name": row["display_name"]}
                for row in context["replacement_variants"].values()
                if row["is_available"] and row["is_operator_reviewed"]
            ],
        },
        provider=provider,
    )
    parsed = _json_object(ai.get("parsed_output"))
    action, interpretation_errors = _normalize_interpreted_action(context, parsed)
    message = str(parsed.get("response_text") or "").strip()
    if not message:
        interpretation_errors.append("A caterer response message is required.")
    validation = _validate_action(context, action, extra_errors=interpretation_errors)
    status = "ready" if validation["valid"] else "draft"
    row = (
        client.table("autopilot_exception_resolutions")
        .insert(
            {
                "exception_id": exception_id,
                "caterer_reply_id": context["reply"]["id"],
                "source_order_run_id": context["order_run"]["id"],
                "operator_instruction": instruction,
                "ai_interpretation_id": ai["id"],
                "proposed_action": action,
                "edited_action": action,
                "proposed_message_text": message,
                "final_message_text": message,
                "validation_report": validation,
                "status": status,
                "created_by": actor_id,
                "created_by_name": actor_name,
                "idempotency_key": key,
            }
        )
        .execute()
        .data[0]
    )
    _supersede_other_drafts(client, exception_id=exception_id, keep_id=row["id"])
    _audit(
        client,
        order_run_id=context["order_run"]["id"],
        actor_name=actor_name,
        action="exception_resolution_proposed",
        entity_type="exception_resolution",
        entity_id=row["id"],
        reason=instruction,
        after_state={
            "exception_id": exception_id,
            "status": status,
            "validation_report": validation,
        },
    )
    return row


def edit_resolution_preview(
    client: Client,
    *,
    resolution_id: str,
    action: dict[str, Any],
    message_text: str,
    actor_id: str,
) -> dict[str, Any]:
    """Persist operator edits and revalidate them against current backend facts."""
    resolution = _select_one(client, "autopilot_exception_resolutions", resolution_id)
    if resolution.get("status") in {"applied", "superseded"}:
        raise ValueError("Applied or superseded previews cannot be edited.")
    if str(resolution.get("created_by") or "") != _required("actor_id", actor_id):
        raise ValueError("Only the operator who created this preview can edit it.")
    context = _resolution_context(client, str(resolution["exception_id"]))
    normalized = _normalize_edited_action(action)
    validation = _validate_action(context, normalized)
    cleaned_message = _required("message_text", message_text)
    status = "ready" if validation["valid"] else "draft"
    return _update(
        client,
        "autopilot_exception_resolutions",
        resolution_id,
        {
            "edited_action": normalized,
            "final_message_text": cleaned_message,
            "validation_report": validation,
            "status": status,
            "failure_detail": None,
        },
    )


def apply_resolution_preview(
    client: Client,
    *,
    resolution_id: str,
    actor_id: str,
    actor_name: str,
    email_provider: Any | None = None,
) -> dict[str, Any]:
    """Revalidate and apply one ready preview with retry-safe side effects."""
    actor_id = _required("actor_id", actor_id)
    actor_name = _required("actor_name", actor_name)
    resolution = _select_one(client, "autopilot_exception_resolutions", resolution_id)
    if resolution.get("status") == "applied":
        return resolution
    if resolution.get("status") == "superseded":
        raise ValueError("Superseded previews cannot be applied.")
    recovered = _recover_completed_side_effects(
        client,
        resolution=resolution,
        actor_id=actor_id,
        actor_name=actor_name,
    )
    if recovered is not None:
        return recovered
    if resolution.get("status") not in {"ready", "failed"}:
        raise ValueError("Only a ready preview can be applied.")

    try:
        context = _resolution_context(client, str(resolution["exception_id"]))
        if _source_order_chain_changed(
            client,
            source_order_run_id=str(resolution["source_order_run_id"]),
            resolution_id=resolution_id,
        ):
            raise ValueError("The source order chain changed after this preview was created.")
        action = _normalize_edited_action(_json_object(resolution.get("edited_action")))
        validation = _validate_action(context, action)
        if not validation["valid"]:
            _update(
                client,
                "autopilot_exception_resolutions",
                resolution_id,
                {"status": "draft", "validation_report": validation},
            )
            raise ValueError("Resolution preview is no longer valid.")
        previous_fingerprint = _json_object(resolution.get("validation_report")).get(
            "source_order_fingerprint"
        )
        if previous_fingerprint and previous_fingerprint != validation["source_order_fingerprint"]:
            raise ValueError("The source order chain changed after this preview was validated.")

        resulting_run = context["order_run"]
        if action["resolution_type"] == "revise_and_reply":
            resulting_run = _existing_or_create_revised_run(
                client,
                resolution=resolution,
                context=context,
                action=action,
                actor_name=actor_name,
            )
        communication = _existing_resolution_communication(client, resolution_id)
        if communication is None:
            export = record_exception_reply_communication(
                client,
                resolution_id=resolution_id,
                order_run_id=resulting_run["id"],
                caterer_id=context["exception"]["caterer_id"],
                caterer_reply_id=context["reply"]["id"],
                message_text=_required(
                    "final_message_text", str(resolution.get("final_message_text") or "")
                ),
                include_authoritative_order=action["resolution_type"] == "revise_and_reply",
                actor_name=actor_name,
                reason="Operator approved caterer reply exception resolution.",
            )
            communication = export["communication"]
            resolution = _update(
                client,
                "autopilot_exception_resolutions",
                resolution_id,
                {
                    "resulting_order_run_id": (
                        resulting_run["id"]
                        if action["resolution_type"] == "revise_and_reply"
                        else None
                    ),
                    "resulting_communication_id": communication["id"],
                },
            )
        if communication.get("status") != "sent":
            send = send_caterer_emails(
                client,
                order_run_id=resulting_run["id"],
                communication_ids=[communication["id"]],
                actor_name=actor_name,
                reason="Operator approved caterer reply exception resolution.",
                provider=email_provider,
            )
            if send["failed"]:
                raise ValueError("The approved exception response could not be sent.")

        now = _utc_now_iso()
        exception_status = _select_one(
            client, "autopilot_exceptions", str(resolution["exception_id"])
        )
        if exception_status.get("status") != "open":
            raise ValueError("The exception is no longer open.")
        client.table("autopilot_exceptions").update(
            {
                "status": "resolved",
                "resolved_at": now,
                "resolved_by": actor_id,
                "resolved_note": resolution.get("operator_instruction"),
            }
        ).eq("id", resolution["exception_id"]).execute()
        _audit(
            client,
            order_run_id=resulting_run["id"],
            actor_name=actor_name,
            action="autopilot_exception_resolved",
            entity_type="autopilot_exception",
            entity_id=str(resolution["exception_id"]),
            reason=str(resolution.get("operator_instruction") or "Applied resolution."),
            after_state={
                "status": "resolved",
                "exception_resolution_id": resolution_id,
            },
        )
        reply_status = (
            "auto_adjusted" if action["resolution_type"] == "revise_and_reply" else "auto_handled"
        )
        client.table("caterer_reply_intake").update(
            {
                "handled_status": reply_status,
                "handled_at": now,
                "handling_summary": resolution.get("final_message_text"),
                "metadata": {
                    **(context["reply"].get("metadata") or {}),
                    "exception_resolution_id": resolution_id,
                    "revised_order_run_id": (
                        resulting_run["id"]
                        if action["resolution_type"] == "revise_and_reply"
                        else None
                    ),
                    "revised_communication_id": communication["id"],
                },
            }
        ).eq("id", context["reply"]["id"]).execute()
        applied = _update(
            client,
            "autopilot_exception_resolutions",
            resolution_id,
            {
                "status": "applied",
                "applied_by": actor_id,
                "applied_by_name": actor_name,
                "applied_at": now,
                "resulting_order_run_id": (
                    resulting_run["id"] if action["resolution_type"] == "revise_and_reply" else None
                ),
                "resulting_communication_id": communication["id"],
                "validation_report": validation,
                "failure_detail": None,
            },
        )
        _audit(
            client,
            order_run_id=resulting_run["id"],
            actor_name=actor_name,
            action="exception_resolution_applied",
            entity_type="exception_resolution",
            entity_id=resolution_id,
            reason=str(resolution.get("operator_instruction") or "Applied resolution."),
            after_state={
                "exception_id": resolution["exception_id"],
                "resolution_type": action["resolution_type"],
                "resulting_order_run_id": applied.get("resulting_order_run_id"),
                "resulting_communication_id": communication["id"],
            },
        )
        return applied
    except ValueError as exc:
        failed = _update(
            client,
            "autopilot_exception_resolutions",
            resolution_id,
            {"status": "failed", "failure_detail": str(exc)},
        )
        _audit(
            client,
            order_run_id=resolution.get("source_order_run_id"),
            actor_name=actor_name,
            action="exception_resolution_failed",
            entity_type="exception_resolution",
            entity_id=resolution_id,
            reason=str(exc),
            after_state={"status": "failed", "failure_detail": str(exc)},
        )
        raise ValueError(str(failed.get("failure_detail") or exc)) from exc


def dismiss_caterer_reply_exception(
    client: Client,
    *,
    exception_id: str,
    note: str,
    actor_id: str,
    actor_name: str,
) -> dict[str, Any]:
    """Dismiss an open caterer reply exception with an audited rationale."""
    note = _required("note", note)
    actor_id = _required("actor_id", actor_id)
    actor_name = _required("actor_name", actor_name)
    context = _resolution_context(client, exception_id)
    now = _utc_now_iso()
    exception = (
        client.table("autopilot_exceptions")
        .update(
            {
                "status": "dismissed",
                "resolved_at": now,
                "resolved_by": actor_id,
                "resolved_note": note,
            }
        )
        .eq("id", exception_id)
        .execute()
        .data[0]
    )
    client.table("caterer_reply_intake").update(
        {
            "handled_status": "ignored",
            "handled_at": now,
            "handling_summary": note,
        }
    ).eq("id", context["reply"]["id"]).execute()
    _audit(
        client,
        order_run_id=context["order_run"]["id"],
        actor_name=actor_name,
        action="autopilot_exception_dismissed",
        entity_type="autopilot_exception",
        entity_id=exception_id,
        reason=note,
        after_state={"status": "dismissed", "resolved_by": actor_id},
    )
    return exception


def _resolution_context(client: Client, exception_id: str) -> dict[str, Any]:
    exception = _select_one(client, "autopilot_exceptions", _required("exception_id", exception_id))
    if exception.get("category") != "caterer_reply":
        raise ValueError("Operator-guided resolution is only available for caterer replies.")
    if exception.get("status") != "open":
        raise ValueError("The caterer reply exception is no longer open.")
    reply_id = str((exception.get("metadata") or {}).get("caterer_reply_id") or "")
    reply = _select_one(client, "caterer_reply_intake", _required("caterer_reply_id", reply_id))
    order_run = _select_one(client, "order_runs", str(exception.get("order_run_id") or ""))
    if order_run.get("status") != "approved" or int(order_run.get("issue_count") or 0) != 0:
        raise ValueError("Only an approved, issue-free source order can be resolved.")

    sessions = {row["id"]: row for row in _select(client, "sessions")}
    dishes = {row["id"]: row for row in _select(client, "dishes")}
    variants = {row["id"]: row for row in _select(client, "dish_variants")}
    lines = _select(client, "order_lines", "*", order_run_id=order_run["id"])
    allocations = _select(client, "order_allocations", "*", order_run_id=order_run["id"])
    caterer_id = str(exception.get("caterer_id") or "")
    caterer_lines = [
        row
        for row in lines
        if sessions.get(row.get("session_id"), {}).get("caterer_id") == caterer_id
    ]
    current_variant_ids = {str(row["dish_variant_id"]) for row in caterer_lines}
    current_variants = {
        variant_id: _variant_context(variants[variant_id], dishes)
        for variant_id in current_variant_ids
        if variant_id in variants
    }
    replacement_variants = {
        str(variant["id"]): _variant_context(variant, dishes)
        for variant in variants.values()
        if dishes.get(variant.get("dish_id"), {}).get("caterer_id") == caterer_id
    }
    return {
        "exception": exception,
        "reply": reply,
        "order_run": order_run,
        "sessions": sessions,
        "dishes": dishes,
        "variants": variants,
        "lines": lines,
        "allocations": allocations,
        "caterer_lines": caterer_lines,
        "current_variants": current_variants,
        "replacement_variants": replacement_variants,
    }


def _normalize_interpreted_action(
    context: dict[str, Any], parsed: dict[str, Any]
) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    mappings = []
    for mapping in parsed.get("replacement_mappings") or []:
        source = _match_named_variant(
            context["current_variants"], str(mapping.get("source_item") or "")
        )
        replacement = _match_named_variant(
            context["replacement_variants"], str(mapping.get("replacement_item") or "")
        )
        if source is None:
            errors.append(
                f"Source item did not match the current order: {mapping.get('source_item')}"
            )
        if replacement is None:
            errors.append(
                "Replacement did not match one same-caterer dish: "
                f"{mapping.get('replacement_item')}"
            )
        if source and replacement:
            mappings.append(
                {
                    "source_variant_id": source["id"],
                    "replacement_variant_id": replacement["id"],
                }
            )
    removals = []
    for name in parsed.get("removal_requests") or []:
        source = _match_named_variant(context["current_variants"], str(name))
        if source is None:
            errors.append(f"Removal did not match the current order: {name}")
        else:
            removals.append(source["id"])
    if parsed.get("ambiguity_flag") or parsed.get("needs_human_review"):
        errors.append("The instruction was interpreted as ambiguous and requires operator edits.")
    return (
        {
            "resolution_type": parsed.get("resolution_type") or "reply_only",
            "mappings": mappings,
            "removals": removals,
        },
        errors,
    )


def _normalize_edited_action(action: dict[str, Any]) -> dict[str, Any]:
    resolution_type = str(action.get("resolution_type") or "")
    if resolution_type not in {"revise_and_reply", "reply_only"}:
        raise ValueError("resolution_type must be revise_and_reply or reply_only.")
    mappings = []
    for row in action.get("mappings") or []:
        mappings.append(
            {
                "source_variant_id": _required(
                    "source_variant_id", str(row.get("source_variant_id") or "")
                ),
                "replacement_variant_id": _required(
                    "replacement_variant_id", str(row.get("replacement_variant_id") or "")
                ),
            }
        )
    removals = [
        _required("removal variant id", str(value)) for value in action.get("removals") or []
    ]
    return {
        "resolution_type": resolution_type,
        "mappings": mappings,
        "removals": removals,
    }


def _validate_action(
    context: dict[str, Any],
    action: dict[str, Any],
    *,
    extra_errors: list[str] | None = None,
) -> dict[str, Any]:
    errors = list(extra_errors or [])
    mappings = action.get("mappings") or []
    removals = action.get("removals") or []
    source_ids = [str(row.get("source_variant_id") or "") for row in mappings]
    if len(source_ids) != len(set(source_ids)):
        errors.append("Each current order item can have only one replacement mapping.")
    if set(source_ids) & set(removals):
        errors.append("An item cannot be both replaced and removed.")
    if action.get("resolution_type") == "reply_only" and (mappings or removals):
        errors.append("Reply-only resolutions cannot change order items.")
    if action.get("resolution_type") == "revise_and_reply" and not (mappings or removals):
        errors.append("Order revisions require at least one replacement or removal.")

    affected_allocations: list[dict[str, Any]] = []
    affected_lines: list[dict[str, Any]] = []
    projected_prices: dict[tuple[str, str], set[int]] = defaultdict(set)
    mapping_by_source = {
        str(row.get("source_variant_id")): str(row.get("replacement_variant_id"))
        for row in mappings
    }
    for source_id, replacement_id in mapping_by_source.items():
        if source_id not in context["current_variants"]:
            errors.append(f"Source variant {source_id} is not in the current caterer order.")
            continue
        replacement = context["replacement_variants"].get(replacement_id)
        if not replacement:
            errors.append(f"Replacement variant {replacement_id} is not from the same caterer.")
            continue
        if not replacement["is_available"]:
            errors.append(f"{replacement['display_name']} is not marked available.")
        if not replacement["is_operator_reviewed"]:
            errors.append(f"{replacement['display_name']} has not been operator reviewed.")
        if replacement_id == source_id:
            errors.append(f"{replacement['display_name']} cannot replace itself.")
        option = _dish_option(context, replacement_id)
        source_allocations = [
            row
            for row in context["allocations"]
            if row.get("status") == "allocated" and str(row.get("dish_variant_id")) == source_id
        ]
        for allocation in source_allocations:
            reasons = dish_failure_reasons(option, set(allocation.get("dietary_tag_codes") or []))
            if reasons:
                errors.append(
                    f"Replacement is unsafe for allocation {allocation.get('id')}: "
                    f"{', '.join(reasons)}."
                )
        affected_allocations.extend(source_allocations)
        source_lines = [
            row for row in context["caterer_lines"] if str(row["dish_variant_id"]) == source_id
        ]
        affected_lines.extend(source_lines)
        for line in source_lines:
            projected_prices[(str(line["session_id"]), replacement_id)].add(
                int(line["unit_price_cents"])
            )

    for removal_id in removals:
        if removal_id not in context["current_variants"]:
            errors.append(f"Removal variant {removal_id} is not in the current caterer order.")
            continue
        allocated = [
            row
            for row in context["allocations"]
            if row.get("status") == "allocated" and str(row.get("dish_variant_id")) == removal_id
        ]
        if allocated:
            errors.append(
                f"Removal would leave {len(allocated)} allocated student(s) without a meal."
            )
        affected_lines.extend(
            row for row in context["caterer_lines"] if str(row["dish_variant_id"]) == removal_id
        )

    for line in context["lines"]:
        source_id = str(line["dish_variant_id"])
        target_id = mapping_by_source.get(source_id, source_id)
        if source_id in removals:
            continue
        projected_prices[(str(line["session_id"]), target_id)].add(int(line["unit_price_cents"]))
    if any(len(prices) > 1 for prices in projected_prices.values()):
        errors.append("Merged resulting order lines have conflicting unit prices.")

    students = sorted(
        {str(row.get("student_id")) for row in affected_allocations if row.get("student_id")}
    )
    sessions = sorted(
        {
            str(row.get("session_id"))
            for row in affected_lines + affected_allocations
            if row.get("session_id")
        }
    )
    return {
        "valid": not errors,
        "errors": errors,
        "warnings": [],
        "source_order_fingerprint": _order_fingerprint(context),
        "affected_session_ids": sessions,
        "affected_meal_count": len(affected_allocations),
        "affected_student_ids": students,
    }


def _existing_or_create_revised_run(
    client: Client,
    *,
    resolution: dict[str, Any],
    context: dict[str, Any],
    action: dict[str, Any],
    actor_name: str,
) -> dict[str, Any]:
    for row in _select(client, "order_runs"):
        if (row.get("input_snapshot") or {}).get("exception_resolution_id") == resolution["id"]:
            return row
    now = _utc_now_iso()
    source = context["order_run"]
    payload = {
        "service_week_start": source["service_week_start"],
        "status": "approved",
        "algorithm_version": RESOLUTION_ALGORITHM_VERSION,
        "generated_by": actor_name,
        "input_snapshot": {
            **(source.get("input_snapshot") or {}),
            "parent_order_run_id": source["id"],
            "caterer_reply_id": context["reply"]["id"],
            "exception_resolution_id": resolution["id"],
            "operator_resolution": {
                "action": action,
                "instruction": resolution.get("operator_instruction"),
                "actor_name": actor_name,
                "recorded_at": now,
            },
        },
        "issue_count": 0,
        "approved_at": now,
        "approved_by": actor_name,
        "approval_note": "Operator approved caterer reply exception resolution.",
    }
    if source.get("service_week_end") is not None:
        payload["service_week_end"] = source["service_week_end"]
    revised = client.table("order_runs").insert(payload).execute().data[0]
    mapping = {
        str(row["source_variant_id"]): str(row["replacement_variant_id"])
        for row in action["mappings"]
    }
    removals = set(action["removals"])
    for allocation in context["allocations"]:
        copied = _copy_without_identity(allocation)
        copied["order_run_id"] = revised["id"]
        source_variant_id = str(allocation.get("dish_variant_id") or "")
        target_variant_id = mapping.get(source_variant_id)
        if target_variant_id:
            target = context["variants"][target_variant_id]
            copied["dish_variant_id"] = target_variant_id
            copied["dish_id"] = target["dish_id"]
        client.table("order_allocations").insert(copied).execute()

    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for line in context["lines"]:
        source_variant_id = str(line["dish_variant_id"])
        if source_variant_id in removals:
            continue
        target_variant_id = mapping.get(source_variant_id, source_variant_id)
        target_variant = context["variants"][target_variant_id]
        key = (str(line["session_id"]), target_variant_id)
        if key not in grouped:
            grouped[key] = {
                **_copy_without_identity(line),
                "order_run_id": revised["id"],
                "dish_id": target_variant["dish_id"],
                "dish_variant_id": target_variant_id,
                "quantity": 0,
                "line_total_cents": 0,
            }
        grouped[key]["quantity"] += int(line["quantity"])
        grouped[key]["line_total_cents"] = grouped[key]["quantity"] * int(
            grouped[key]["unit_price_cents"]
        )
    for line in grouped.values():
        client.table("order_lines").insert(line).execute()
    _audit(
        client,
        order_run_id=revised["id"],
        actor_name=actor_name,
        action="order_run_revised",
        entity_type="order_run",
        entity_id=revised["id"],
        reason="Operator approved simultaneous caterer reply mappings.",
        after_state={
            "parent_order_run_id": source["id"],
            "exception_resolution_id": resolution["id"],
            "action": action,
        },
    )
    return revised


def _variant_context(variant: dict[str, Any], dishes: dict[str, dict[str, Any]]) -> dict[str, Any]:
    dish = dishes.get(variant.get("dish_id"), {})
    display_name = str(dish.get("name") or "")
    if not variant.get("is_default"):
        display_name = f"{display_name} - {variant.get('name')}"
    return {
        **variant,
        "display_name": display_name,
        "is_operator_reviewed": variant.get("ingredient_flags_source") == "operator_reviewed",
    }


def _dish_option(context: dict[str, Any], variant_id: str) -> DishOption:
    variant = context["variants"][variant_id]
    dish = context["dishes"][variant["dish_id"]]
    return DishOption(
        id=variant_id,
        name=_variant_context(variant, context["dishes"])["display_name"],
        dish_id=dish["id"],
        is_gluten_free=bool(variant.get("is_gluten_free")),
        is_dairy_free=bool(variant.get("is_dairy_free")),
        is_nut_free=bool(variant.get("is_nut_free")),
        is_vegetarian_option=bool(variant.get("is_vegetarian_option")),
        is_halal_inferred=bool(variant.get("is_halal_inferred")),
        has_no_declared_tags=bool(variant.get("has_no_declared_tags")),
        contains_pork=bool(variant.get("contains_pork")),
        contains_beef=bool(variant.get("contains_beef")),
        contains_red_meat=bool(variant.get("contains_red_meat")),
        contains_fish=bool(variant.get("contains_fish")),
        contains_shellfish=bool(variant.get("contains_shellfish")),
        ingredient_flags_source=str(variant.get("ingredient_flags_source") or "unreviewed"),
    )


def _match_named_variant(variants: dict[str, dict[str, Any]], value: str) -> dict[str, Any] | None:
    normalized = _normalize_name(value)
    exact = [row for row in variants.values() if _normalize_name(row["display_name"]) == normalized]
    if len(exact) == 1:
        return exact[0]
    return None


def _normalize_name(value: str) -> str:
    return " ".join("".join(char.lower() if char.isalnum() else " " for char in value).split())


def _order_fingerprint(context: dict[str, Any]) -> str:
    payload = {
        "order_run": {
            "id": context["order_run"]["id"],
            "status": context["order_run"].get("status"),
            "issue_count": context["order_run"].get("issue_count"),
        },
        "lines": sorted(
            [
                {
                    "id": row.get("id"),
                    "session_id": row.get("session_id"),
                    "dish_variant_id": row.get("dish_variant_id"),
                    "quantity": row.get("quantity"),
                    "unit_price_cents": row.get("unit_price_cents"),
                }
                for row in context["lines"]
            ],
            key=lambda row: str(row["id"]),
        ),
        "allocations": sorted(
            [
                {
                    "id": row.get("id"),
                    "student_id": row.get("student_id"),
                    "session_id": row.get("session_id"),
                    "dish_variant_id": row.get("dish_variant_id"),
                    "status": row.get("status"),
                    "dietary_tag_codes": row.get("dietary_tag_codes") or [],
                }
                for row in context["allocations"]
            ],
            key=lambda row: str(row["id"]),
        ),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _existing_resolution_communication(client: Client, resolution_id: str) -> dict[str, Any] | None:
    rows = _select(
        client,
        "order_communications",
        "*",
        exception_resolution_id=resolution_id,
    )
    return rows[0] if rows else None


def _source_order_chain_changed(
    client: Client, *, source_order_run_id: str, resolution_id: str
) -> bool:
    for row in _select(client, "order_runs"):
        snapshot = row.get("input_snapshot") or {}
        if snapshot.get("parent_order_run_id") != source_order_run_id:
            continue
        if snapshot.get("exception_resolution_id") == resolution_id:
            continue
        return True
    return False


def _recover_completed_side_effects(
    client: Client,
    *,
    resolution: dict[str, Any],
    actor_id: str,
    actor_name: str,
) -> dict[str, Any] | None:
    """Finalize a retry when sending completed before the final row update."""
    communication_id = resolution.get("resulting_communication_id")
    if not communication_id:
        return None
    communication = _select_one(client, "order_communications", str(communication_id))
    if communication.get("status") != "sent":
        return None
    exception = _select_one(client, "autopilot_exceptions", str(resolution["exception_id"]))
    if exception.get("status") == "open":
        return None
    if exception.get("status") != "resolved":
        raise ValueError("The exception was closed independently of this resolution.")
    action = _normalize_edited_action(_json_object(resolution.get("edited_action")))
    now = _utc_now_iso()
    client.table("caterer_reply_intake").update(
        {
            "handled_status": (
                "auto_adjusted"
                if action["resolution_type"] == "revise_and_reply"
                else "auto_handled"
            ),
            "handled_at": now,
            "handling_summary": resolution.get("final_message_text"),
        }
    ).eq("id", resolution["caterer_reply_id"]).execute()
    return _update(
        client,
        "autopilot_exception_resolutions",
        resolution["id"],
        {
            "status": "applied",
            "applied_by": actor_id,
            "applied_by_name": actor_name,
            "applied_at": now,
            "failure_detail": None,
        },
    )


def _supersede_other_drafts(client: Client, *, exception_id: str, keep_id: str) -> None:
    for row in _select(client, "autopilot_exception_resolutions", "*", exception_id=exception_id):
        if row["id"] != keep_id and row.get("status") in {"draft", "ready", "failed"}:
            _update(
                client,
                "autopilot_exception_resolutions",
                row["id"],
                {"status": "superseded"},
            )


def _copy_without_identity(row: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value for key, value in row.items() if key not in {"id", "created_at", "updated_at"}
    }


def _select(client: Client, table: str, columns: str = "*", **eq: Any) -> list[dict[str, Any]]:
    query = client.table(table).select(columns)
    for key, value in eq.items():
        query = query.eq(key, value)
    return query.execute().data


def _select_one(client: Client, table: str, row_id: str) -> dict[str, Any]:
    rows = _select(client, table, id=_required(f"{table}_id", row_id))
    if not rows:
        raise ValueError(f"{table} row {row_id!r} does not exist.")
    return rows[0]


def _update(client: Client, table: str, row_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    rows = client.table(table).update(payload).eq("id", row_id).execute().data
    if not rows:
        raise ValueError(f"{table} row {row_id!r} does not exist.")
    return rows[0]


def _audit(
    client: Client,
    *,
    order_run_id: str | None,
    actor_name: str,
    action: str,
    entity_type: str,
    entity_id: str,
    reason: str,
    after_state: dict[str, Any],
) -> None:
    client.table("audit_log").insert(
        {
            "order_run_id": order_run_id,
            "actor_name": actor_name,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "reason": _required("reason", reason),
            "before_state": {},
            "after_state": after_state,
        }
    ).execute()


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _required(name: str, value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError(f"{name} is required.")
    return cleaned


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()
