"""Narrow Streamlit MVP for menu offers and dish review.

This is intentionally separate from the future full operator app.
Run with:
    uv run streamlit run app/menu_setup_mvp.py
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date

import pandas as pd
import streamlit as st

from padea_catering.db import get_client
from padea_catering.menu_setup import (
    DishReviewUpdate,
    get_default_week_start,
    get_dish_review_rows,
    get_menu_offer_state,
    save_dish_review,
    save_menu_offers,
    validate_offer_count,
)
from padea_catering.ordering.generator import build_order_plan
from padea_catering.validation.checks import run_all_checks

st.set_page_config(page_title="Padea Menu Setup MVP", layout="wide")


def _flag_summary(dish: dict) -> str:
    flags = []
    if dish["is_gluten_free"]:
        flags.append("GF")
    if dish["is_dairy_free"]:
        flags.append("DF")
    if dish["is_nut_free"]:
        flags.append("NF")
    if dish["is_vegetarian_option"]:
        flags.append("VO")
    if dish["is_halal_inferred"]:
        flags.append("Halal")
    if dish["has_no_declared_tags"]:
        flags.append("No declared tags")
    return ", ".join(flags) if flags else "No flags"


def _findings_table(findings) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "severity": finding.severity,
                "category": finding.category,
                "message": finding.message,
            }
            for finding in findings
        ]
    )


def _issue_table(issues) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "severity": issue.severity,
                "code": issue.code,
                "message": issue.message,
            }
            for issue in issues
        ]
    )


def render_menu_offers(week_start: date, selected_by: str) -> None:
    st.subheader("Menu Offers")
    st.caption("Temporary MVP: select the offered dishes for each active caterer this week.")
    state = get_menu_offer_state(get_client(), week_start)
    if not state:
        st.info("No active caterers found for this week.")
        return

    for caterer in state:
        with st.container(border=True):
            st.markdown(f"### {caterer['caterer_name']}")
            st.caption(f"Region: {caterer['region'] or 'unknown'}")
            valid_tiers = caterer["valid_tiers"]
            selected_ids = sorted(caterer["selected_dish_ids"])
            dishes = caterer["dishes"]
            dish_by_id = {dish["id"]: dish for dish in dishes}

            offer_df = pd.DataFrame(
                [
                    {
                        "selected": dish["id"] in caterer["selected_dish_ids"],
                        "dish": dish["name"],
                        "declared flags": _flag_summary(dish),
                        "review": dish["ingredient_flags_source"],
                    }
                    for dish in dishes
                ]
            )
            st.dataframe(offer_df, use_container_width=True, hide_index=True)

            chosen = st.multiselect(
                "Offered dishes",
                options=[dish["id"] for dish in dishes],
                default=selected_ids,
                format_func=lambda dish_id, mapping=dish_by_id: mapping[dish_id]["name"],
                key=f"offers-{caterer['caterer_id']}",
            )
            errors = validate_offer_count(len(chosen), valid_tiers)
            if errors:
                st.error(" ".join(errors))
            else:
                st.success(f"{len(chosen)} dishes selected; valid tiers are {sorted(valid_tiers)}.")

            if st.button("Save offers", key=f"save-offers-{caterer['caterer_id']}"):
                try:
                    save_menu_offers(
                        get_client(),
                        week_start,
                        caterer["caterer_id"],
                        chosen,
                        selected_by,
                    )
                except ValueError as exc:
                    st.error(str(exc))
                else:
                    st.success("Menu offers saved.")
                    st.rerun()


def render_dish_review(selected_by: str) -> None:
    st.subheader("Dish Ingredient Review")
    st.caption("Temporary MVP: confirm keyword-inferred ingredient flags before final app UX.")
    rows = get_dish_review_rows(get_client())
    if not rows:
        st.info("No dishes found.")
        return

    summary_counts = defaultdict(int)
    for row in rows:
        summary_counts[row["ingredient_flags_source"]] += 1
    cols = st.columns(3)
    cols[0].metric("Total dishes", len(rows))
    cols[1].metric("Operator reviewed", summary_counts["operator_reviewed"])
    cols[2].metric("Needs review", len(rows) - summary_counts["operator_reviewed"])

    dish_id = st.selectbox(
        "Dish",
        options=[row["id"] for row in rows],
        format_func=lambda row_id: next(
            f"{row['ingredient_flags_source']} | {row['caterer_name']} | {row['name']}"
            for row in rows
            if row["id"] == row_id
        ),
    )
    row = next(item for item in rows if item["id"] == dish_id)

    with st.container(border=True):
        st.markdown(f"### {row['name']}")
        st.caption(f"{row['caterer_name']} | Current source: {row['ingredient_flags_source']}")
        if row["has_no_declared_tags"]:
            st.warning("This dish had no declared GF/DF/NF/VO tags in the source menu.")

        col_a, col_b, col_c, col_d, col_e = st.columns(5)
        contains_beef = col_a.checkbox("Beef", value=row["contains_beef"])
        contains_pork = col_b.checkbox("Pork", value=row["contains_pork"])
        contains_red_meat = col_c.checkbox("Red meat", value=row["contains_red_meat"])
        contains_fish = col_d.checkbox("Fish", value=row["contains_fish"])
        contains_shellfish = col_e.checkbox("Shellfish", value=row["contains_shellfish"])

        notes = st.text_area("Ingredient notes", value=row["ingredient_notes"] or "")
        reason = st.text_input(
            "Review reason",
            value=row["tags_review_reason"] or "Operator ingredient review",
        )

        if row["tags_reviewed_at"]:
            st.caption(f"Last reviewed by {row['tags_reviewed_by']} at {row['tags_reviewed_at']}.")

        if st.button("Save dish review"):
            try:
                save_dish_review(
                    get_client(),
                    dish_id,
                    DishReviewUpdate(
                        contains_beef=contains_beef,
                        contains_pork=contains_pork,
                        contains_red_meat=contains_red_meat,
                        contains_fish=contains_fish,
                        contains_shellfish=contains_shellfish,
                        reviewed_by=selected_by,
                        review_reason=reason,
                        ingredient_notes=notes.strip() or None,
                    ),
                )
            except ValueError as exc:
                st.error(str(exc))
            else:
                st.success("Dish review saved.")
                st.rerun()


def render_validation(week_start: date) -> None:
    st.subheader("Validation and Dry Run")
    st.caption("This uses the same backend checks as the CLI.")

    if st.button("Run validation"):
        findings = run_all_checks(get_client(), week_start)
        errors = [finding for finding in findings if finding.severity == "error"]
        warnings = [finding for finding in findings if finding.severity == "warning"]
        info = [finding for finding in findings if finding.severity == "info"]
        col_a, col_b, col_c = st.columns(3)
        col_a.metric("Errors", len(errors))
        col_b.metric("Warnings", len(warnings))
        col_c.metric("Info", len(info))
        if findings:
            st.dataframe(_findings_table(findings), use_container_width=True, hide_index=True)
        else:
            st.success("No validation findings.")

    if st.button("Run order dry run"):
        plan = build_order_plan(get_client(), week_start)
        col_a, col_b, col_c = st.columns(3)
        col_a.metric("Allocations", len(plan.allocations))
        col_b.metric("Order lines", 0 if plan.has_blockers else len(plan.order_lines))
        col_c.metric("Issues", len(plan.issues))
        if plan.issues:
            st.error("Order generation is blocked.")
            st.dataframe(_issue_table(plan.issues), use_container_width=True, hide_index=True)
        else:
            st.success("Dry run can generate an order.")


def main() -> None:
    st.title("Menu Setup MVP")
    st.caption(
        "Temporary narrow UI for choosing weekly menu offers and reviewing dish ingredients. "
        "This is not the final operator app."
    )

    client = get_client()
    default_week = get_default_week_start(client)
    with st.sidebar:
        st.header("Setup")
        week_start = st.date_input("Service week start", value=default_week)
        selected_by = st.text_input("Operator name", value="MVP operator")
        st.caption("Uses server-side Supabase access from the local Streamlit process.")

    tab_offers, tab_review, tab_validation = st.tabs(["Menu offers", "Dish review", "Validation"])
    with tab_offers:
        render_menu_offers(week_start, selected_by)
    with tab_review:
        render_dish_review(selected_by)
    with tab_validation:
        render_validation(week_start)


if __name__ == "__main__":
    main()
