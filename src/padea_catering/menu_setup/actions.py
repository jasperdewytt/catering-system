"""Business actions for menu-offer selection and dish variant review.

The Streamlit MVP should remain a thin interface over these functions.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from supabase import Client


@dataclass(frozen=True)
class DishReviewUpdate:
    is_gluten_free: bool
    is_dairy_free: bool
    is_nut_free: bool
    is_vegetarian_option: bool
    is_halal_inferred: bool
    contains_beef: bool
    contains_pork: bool
    contains_red_meat: bool
    contains_fish: bool
    contains_shellfish: bool
    is_available: bool
    reviewed_by: str
    review_reason: str
    ingredient_notes: str | None = None


def _select(client: Client, table: str, columns: str = "*", **eq) -> list[dict[str, Any]]:
    query = client.table(table).select(columns)
    for key, value in eq.items():
        query = query.eq(key, value)
    return query.execute().data


def _review_payload(update: DishReviewUpdate) -> dict[str, Any]:
    reviewed_by = update.reviewed_by.strip()
    review_reason = update.review_reason.strip()
    if not reviewed_by:
        raise ValueError("Reviewer name is required.")
    if not review_reason:
        raise ValueError("Review reason is required.")
    return {
        "is_gluten_free": update.is_gluten_free,
        "is_dairy_free": update.is_dairy_free,
        "is_nut_free": update.is_nut_free,
        "is_vegetarian_option": update.is_vegetarian_option,
        "is_halal_inferred": update.is_halal_inferred,
        "contains_beef": update.contains_beef,
        "contains_pork": update.contains_pork,
        "contains_red_meat": update.contains_red_meat,
        "contains_fish": update.contains_fish,
        "contains_shellfish": update.contains_shellfish,
        "is_available": update.is_available,
        "ingredient_notes": update.ingredient_notes or None,
        "ingredient_flags_source": "operator_reviewed",
        "tags_reviewed_at": datetime.now(UTC).isoformat(),
        "tags_reviewed_by": reviewed_by,
        "tags_review_reason": review_reason,
    }


def get_default_week_start(client: Client) -> date:
    sessions = _select(client, "sessions", "session_date")
    if not sessions:
        raise RuntimeError("No sessions exist; run ingestion before opening menu setup.")
    return min(date.fromisoformat(row["session_date"]) for row in sessions)


def _week_end(week_start: date) -> date:
    return week_start + timedelta(days=6)


def _week_sessions(client: Client, week_start: date) -> list[dict[str, Any]]:
    week_end = _week_end(week_start)
    return [
        row
        for row in _select(client, "sessions", "id, caterer_id, session_date, year_levels")
        if week_start <= date.fromisoformat(row["session_date"]) <= week_end
    ]


def _active_caterer_ids(client: Client, week_start: date) -> set[str]:
    exclusions = {
        row["session_id"]: set(row["excluded_year_levels"])
        for row in _select(client, "exclusions", "session_id, excluded_year_levels")
    }
    active: set[str] = set()
    for session in _week_sessions(client, week_start):
        excluded = exclusions.get(session["id"], set())
        fully_cancelled = bool(excluded) and set(session["year_levels"]).issubset(excluded)
        if not fully_cancelled:
            active.add(session["caterer_id"])
    return active


def validate_offer_count(selected_count: int, valid_tiers: set[int]) -> list[str]:
    if selected_count == 0:
        return ["Select at least one offered option."]
    if selected_count not in valid_tiers:
        return [f"Select one of the valid option counts: {sorted(valid_tiers)}."]
    return []


def _dish_maps(client: Client) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    dishes = {
        row["id"]: row
        for row in _select(
            client,
            "dishes",
            "id, caterer_id, name, has_no_declared_tags",
        )
    }
    caterers = {row["id"]: row["name"] for row in _select(client, "caterers", "id, name")}
    for row in dishes.values():
        row["caterer_name"] = caterers.get(row["caterer_id"], "?")
    return dishes, caterers


def _display_variant(dish_name: str, variant_name: str) -> str:
    return dish_name if variant_name == "Standard" else f"{dish_name} - {variant_name}"


def get_menu_offer_state(client: Client, week_start: date) -> list[dict[str, Any]]:
    """Return active caterers, their orderable variants, tiers, and current offers."""
    active_caterers = _active_caterer_ids(client, week_start)
    caterers = {
        row["id"]: row
        for row in _select(client, "caterers", "id, name, region")
        if row["id"] in active_caterers
    }
    minimums: dict[str, set[int]] = {caterer_id: set() for caterer_id in caterers}
    for row in _select(client, "caterer_weekly_minimums", "caterer_id, menu_item_count"):
        if row["caterer_id"] in minimums:
            minimums[row["caterer_id"]].add(row["menu_item_count"])

    dishes, _ = _dish_maps(client)
    variants_by_caterer: dict[str, list[dict[str, Any]]] = {
        caterer_id: [] for caterer_id in caterers
    }
    variant_to_caterer: dict[str, str] = {}
    for row in _select(
        client,
        "dish_variants",
        (
            "id, dish_id, name, is_available, is_gluten_free, is_dairy_free, is_nut_free, "
            "is_vegetarian_option, is_halal_inferred, has_no_declared_tags, "
            "contains_beef, contains_pork, contains_red_meat, contains_fish, "
            "contains_shellfish, ingredient_flags_source"
        ),
    ):
        dish = dishes.get(row["dish_id"])
        if not dish or dish["caterer_id"] not in variants_by_caterer:
            continue
        caterer_id = dish["caterer_id"]
        row["display_name"] = _display_variant(dish["name"], row["name"])
        row["dish_name"] = dish["name"]
        variants_by_caterer[caterer_id].append(row)
        variant_to_caterer[row["id"]] = caterer_id

    selected_by_caterer: dict[str, set[str]] = {caterer_id: set() for caterer_id in caterers}
    for row in _select(client, "menu_offers", "service_week_start, dish_variant_id"):
        if row["service_week_start"] != week_start.isoformat():
            continue
        caterer_id = variant_to_caterer.get(row["dish_variant_id"])
        if caterer_id:
            selected_by_caterer[caterer_id].add(row["dish_variant_id"])

    state = []
    for caterer_id, caterer in caterers.items():
        variants = sorted(variants_by_caterer[caterer_id], key=lambda row: row["display_name"])
        state.append(
            {
                "caterer_id": caterer_id,
                "caterer_name": caterer["name"],
                "region": caterer["region"],
                "valid_tiers": minimums[caterer_id],
                "variants": variants,
                "selected_variant_ids": selected_by_caterer[caterer_id],
            }
        )
    return sorted(state, key=lambda row: row["caterer_name"])


def save_menu_offers(
    client: Client,
    week_start: date,
    caterer_id: str,
    variant_ids: list[str],
    selected_by: str,
) -> None:
    selected_by = selected_by.strip()
    if not selected_by:
        raise ValueError("selected_by is required.")

    valid_tiers = {
        row["menu_item_count"]
        for row in _select(client, "caterer_weekly_minimums", "caterer_id, menu_item_count")
        if row["caterer_id"] == caterer_id
    }
    errors = validate_offer_count(len(variant_ids), valid_tiers)
    if errors:
        raise ValueError(" ".join(errors))

    dishes, _ = _dish_maps(client)
    variants = {
        row["id"]: row
        for row in _select(client, "dish_variants", "id, dish_id, is_available")
        if row["dish_id"] in dishes
    }
    selected = []
    for variant_id in sorted(set(variant_ids)):
        variant = variants.get(variant_id)
        if not variant:
            raise ValueError("All selected options must exist.")
        dish = dishes[variant["dish_id"]]
        if dish["caterer_id"] != caterer_id:
            raise ValueError("All selected options must belong to the caterer.")
        if not variant["is_available"]:
            raise ValueError("Unavailable options cannot be offered.")
        selected.append((variant_id, variant["dish_id"]))

    existing_offer_ids = []
    for row in _select(client, "menu_offers", "id, service_week_start, dish_variant_id"):
        if row["service_week_start"] != week_start.isoformat():
            continue
        variant = variants.get(row["dish_variant_id"])
        if variant and dishes[variant["dish_id"]]["caterer_id"] == caterer_id:
            existing_offer_ids.append(row["id"])

    if existing_offer_ids:
        client.table("menu_offers").delete().in_("id", existing_offer_ids).execute()

    offer_rows = [
        {
            "service_week_start": week_start.isoformat(),
            "dish_id": dish_id,
            "dish_variant_id": variant_id,
            "selected_by": selected_by,
        }
        for variant_id, dish_id in selected
    ]
    if offer_rows:
        client.table("menu_offers").insert(offer_rows).execute()


def get_base_dish_rows(client: Client) -> list[dict[str, Any]]:
    dishes, _ = _dish_maps(client)
    return sorted(dishes.values(), key=lambda row: (row["caterer_name"], row["name"]))


def get_dish_review_rows(client: Client) -> list[dict[str, Any]]:
    dishes, _ = _dish_maps(client)
    rows = _select(
        client,
        "dish_variants",
        (
            "id, dish_id, name, is_default, is_available, has_no_declared_tags, "
            "is_gluten_free, is_dairy_free, is_nut_free, is_vegetarian_option, "
            "is_halal_inferred, contains_beef, contains_pork, contains_red_meat, "
            "contains_fish, contains_shellfish, ingredient_notes, ingredient_flags_source, "
            "tags_reviewed_at, tags_reviewed_by, tags_review_reason"
        ),
    )
    enriched = []
    for row in rows:
        dish = dishes.get(row["dish_id"])
        if not dish:
            continue
        row["dish_name"] = dish["name"]
        row["display_name"] = _display_variant(dish["name"], row["name"])
        row["caterer_id"] = dish["caterer_id"]
        row["caterer_name"] = dish["caterer_name"]
        enriched.append(row)
    return sorted(
        enriched,
        key=lambda row: (
            row["ingredient_flags_source"] == "operator_reviewed",
            not row["has_no_declared_tags"],
            row["caterer_name"],
            row["display_name"],
        ),
    )


def create_dish_variant(
    client: Client,
    dish_id: str,
    variant_name: str,
    update: DishReviewUpdate,
) -> None:
    variant_name = variant_name.strip()
    if not variant_name:
        raise ValueError("Variant name is required.")
    payload = _review_payload(update)
    payload["has_no_declared_tags"] = False
    client.table("dish_variants").insert(
        {
            "dish_id": dish_id,
            "name": variant_name,
            "is_default": False,
            **payload,
        }
    ).execute()


def save_dish_review(client: Client, dish_variant_id: str, update: DishReviewUpdate) -> None:
    client.table("dish_variants").update(_review_payload(update)).eq(
        "id", dish_variant_id
    ).execute()
