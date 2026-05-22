"""Business actions for menu-offer selection and dish ingredient review.

The Streamlit MVP should remain a thin interface over these functions.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from supabase import Client


@dataclass(frozen=True)
class DishReviewUpdate:
    contains_beef: bool
    contains_pork: bool
    contains_red_meat: bool
    contains_fish: bool
    contains_shellfish: bool
    reviewed_by: str
    review_reason: str
    ingredient_notes: str | None = None


def _select(client: Client, table: str, columns: str = "*", **eq) -> list[dict[str, Any]]:
    query = client.table(table).select(columns)
    for key, value in eq.items():
        query = query.eq(key, value)
    return query.execute().data


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
        return ["Select at least one offered dish."]
    if selected_count not in valid_tiers:
        return [f"Select one of the valid menu counts: {sorted(valid_tiers)}."]
    return []


def get_menu_offer_state(client: Client, week_start: date) -> list[dict[str, Any]]:
    """Return active caterers, their dishes, tiers, and current offers."""
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

    dishes_by_caterer: dict[str, list[dict[str, Any]]] = {caterer_id: [] for caterer_id in caterers}
    dish_to_caterer: dict[str, str] = {}
    for row in _select(
        client,
        "dishes",
        (
            "id, caterer_id, name, is_gluten_free, is_dairy_free, is_nut_free, "
            "is_vegetarian_option, is_halal_inferred, has_no_declared_tags, "
            "ingredient_flags_source"
        ),
    ):
        caterer_id = row["caterer_id"]
        if caterer_id in dishes_by_caterer:
            dishes_by_caterer[caterer_id].append(row)
            dish_to_caterer[row["id"]] = caterer_id

    selected_by_caterer: dict[str, set[str]] = {caterer_id: set() for caterer_id in caterers}
    for row in _select(client, "menu_offers", "service_week_start, dish_id"):
        if row["service_week_start"] != week_start.isoformat():
            continue
        caterer_id = dish_to_caterer.get(row["dish_id"])
        if caterer_id:
            selected_by_caterer[caterer_id].add(row["dish_id"])

    state = []
    for caterer_id, caterer in caterers.items():
        dishes = sorted(dishes_by_caterer[caterer_id], key=lambda row: row["name"])
        state.append(
            {
                "caterer_id": caterer_id,
                "caterer_name": caterer["name"],
                "region": caterer["region"],
                "valid_tiers": minimums[caterer_id],
                "dishes": dishes,
                "selected_dish_ids": selected_by_caterer[caterer_id],
            }
        )
    return sorted(state, key=lambda row: row["caterer_name"])


def save_menu_offers(
    client: Client,
    week_start: date,
    caterer_id: str,
    dish_ids: list[str],
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
    errors = validate_offer_count(len(dish_ids), valid_tiers)
    if errors:
        raise ValueError(" ".join(errors))

    caterer_dish_ids = {
        row["id"]
        for row in _select(client, "dishes", "id, caterer_id")
        if row["caterer_id"] == caterer_id
    }
    unknown = set(dish_ids) - caterer_dish_ids
    if unknown:
        raise ValueError("All selected dishes must belong to the caterer.")

    existing_offer_ids = []
    dish_to_caterer = {
        row["id"]: row["caterer_id"] for row in _select(client, "dishes", "id, caterer_id")
    }
    for row in _select(client, "menu_offers", "id, service_week_start, dish_id"):
        if row["service_week_start"] != week_start.isoformat():
            continue
        if dish_to_caterer.get(row["dish_id"]) == caterer_id:
            existing_offer_ids.append(row["id"])

    if existing_offer_ids:
        client.table("menu_offers").delete().in_("id", existing_offer_ids).execute()

    offer_rows = [
        {
            "service_week_start": week_start.isoformat(),
            "dish_id": dish_id,
            "selected_by": selected_by,
        }
        for dish_id in sorted(set(dish_ids))
    ]
    if offer_rows:
        client.table("menu_offers").insert(offer_rows).execute()


def get_dish_review_rows(client: Client) -> list[dict[str, Any]]:
    caterers = {row["id"]: row["name"] for row in _select(client, "caterers", "id, name")}
    rows = _select(
        client,
        "dishes",
        (
            "id, caterer_id, name, has_no_declared_tags, contains_beef, contains_pork, "
            "contains_red_meat, contains_fish, contains_shellfish, ingredient_notes, "
            "ingredient_flags_source, tags_reviewed_at, tags_reviewed_by, tags_review_reason"
        ),
    )
    for row in rows:
        row["caterer_name"] = caterers.get(row["caterer_id"], "?")
    return sorted(
        rows,
        key=lambda row: (
            row["ingredient_flags_source"] == "operator_reviewed",
            not row["has_no_declared_tags"],
            row["caterer_name"],
            row["name"],
        ),
    )


def save_dish_review(client: Client, dish_id: str, update: DishReviewUpdate) -> None:
    reviewed_by = update.reviewed_by.strip()
    review_reason = update.review_reason.strip()
    if not reviewed_by:
        raise ValueError("Reviewer name is required.")
    if not review_reason:
        raise ValueError("Review reason is required.")

    client.table("dishes").update(
        {
            "contains_beef": update.contains_beef,
            "contains_pork": update.contains_pork,
            "contains_red_meat": update.contains_red_meat,
            "contains_fish": update.contains_fish,
            "contains_shellfish": update.contains_shellfish,
            "ingredient_notes": update.ingredient_notes or None,
            "ingredient_flags_source": "operator_reviewed",
            "tags_reviewed_at": datetime.now(UTC).isoformat(),
            "tags_reviewed_by": reviewed_by,
            "tags_review_reason": review_reason,
        }
    ).eq("id", dish_id).execute()
