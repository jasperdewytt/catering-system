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
    create_dish_variant,
    get_base_dish_rows,
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


def _flag_summary(option: dict) -> str:
    flags = []
    if option["is_gluten_free"]:
        flags.append("GF")
    if option["is_dairy_free"]:
        flags.append("DF")
    if option["is_nut_free"]:
        flags.append("NF")
    if option["is_vegetarian_option"]:
        flags.append("VO")
    if option["is_halal_inferred"]:
        flags.append("Halal")
    if option["contains_beef"]:
        flags.append("Beef")
    if option["contains_pork"]:
        flags.append("Pork")
    if option["contains_fish"]:
        flags.append("Fish")
    if option["contains_shellfish"]:
        flags.append("Shellfish")
    if option["has_no_declared_tags"]:
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
    st.caption("Temporary MVP: select the offered orderable options for each active caterer.")
    state = get_menu_offer_state(get_client(), week_start)
    if not state:
        st.info("No active caterers found for this week.")
        return

    for caterer in state:
        with st.container(border=True):
            st.markdown(f"### {caterer['caterer_name']}")
            st.caption(f"Region: {caterer['region'] or 'unknown'}")
            valid_tiers = caterer["valid_tiers"]
            selected_ids = sorted(caterer["selected_variant_ids"])
            variants = caterer["variants"]
            variant_by_id = {variant["id"]: variant for variant in variants}

            offer_df = pd.DataFrame(
                [
                    {
                        "selected": variant["id"] in caterer["selected_variant_ids"],
                        "option": variant["display_name"],
                        "available": variant["is_available"],
                        "flags": _flag_summary(variant),
                        "review": variant["ingredient_flags_source"],
                    }
                    for variant in variants
                ]
            )
            st.dataframe(offer_df, use_container_width=True, hide_index=True)

            chosen = st.multiselect(
                "Offered options",
                options=[variant["id"] for variant in variants if variant["is_available"]],
                default=selected_ids,
                format_func=lambda variant_id, mapping=variant_by_id: mapping[variant_id][
                    "display_name"
                ],
                key=f"offers-{caterer['caterer_id']}",
            )
            errors = validate_offer_count(len(chosen), valid_tiers)
            if errors:
                st.error(" ".join(errors))
            else:
                st.success(
                    f"{len(chosen)} options selected; valid tiers are {sorted(valid_tiers)}."
                )

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
    st.subheader("Dish and Variant Review")
    st.caption(
        "Temporary MVP: split customisable dishes into concrete orderable options, then review "
        "the safety flags for each option."
    )
    rows = get_dish_review_rows(get_client())
    if not rows:
        st.info("No dish variants found.")
        return

    summary_counts = defaultdict(int)
    for row in rows:
        summary_counts[row["ingredient_flags_source"]] += 1
    cols = st.columns(3)
    cols[0].metric("Total options", len(rows))
    cols[1].metric("Operator reviewed", summary_counts["operator_reviewed"])
    cols[2].metric("Needs review", len(rows) - summary_counts["operator_reviewed"])

    with st.expander("Add a custom option", expanded=False):
        base_dishes = get_base_dish_rows(get_client())
        base_dish_id = st.selectbox(
            "Base menu item",
            options=[row["id"] for row in base_dishes],
            format_func=lambda row_id: next(
                f"{row['caterer_name']} | {row['name']}"
                for row in base_dishes
                if row["id"] == row_id
            ),
        )
        variant_name = st.text_input("Option name", placeholder="Vegetarian, Chicken, Beef, etc.")
        col_a, col_b, col_c, col_d, col_e = st.columns(5)
        new_gf = col_a.checkbox("GF", key="new-gf")
        new_df = col_b.checkbox("DF", key="new-df")
        new_nf = col_c.checkbox("NF", key="new-nf")
        new_vo = col_d.checkbox("Vegetarian option", key="new-vo")
        new_halal = col_e.checkbox("Halal", key="new-halal")

        col_f, col_g, col_h, col_i, col_j = st.columns(5)
        new_beef = col_f.checkbox("Contains beef", key="new-beef")
        new_pork = col_g.checkbox("Contains pork", key="new-pork")
        new_red_meat = col_h.checkbox("Contains red meat", key="new-red-meat")
        new_fish = col_i.checkbox("Contains fish", key="new-fish")
        new_shellfish = col_j.checkbox("Contains shellfish", key="new-shellfish")

        new_notes = st.text_area("Ingredient notes", key="new-notes")
        new_reason = st.text_input("Review reason", value="Operator created custom option")
        if st.button("Create option"):
            try:
                create_dish_variant(
                    get_client(),
                    base_dish_id,
                    variant_name,
                    DishReviewUpdate(
                        is_gluten_free=new_gf,
                        is_dairy_free=new_df,
                        is_nut_free=new_nf,
                        is_vegetarian_option=new_vo,
                        is_halal_inferred=new_halal,
                        contains_beef=new_beef,
                        contains_pork=new_pork,
                        contains_red_meat=new_red_meat,
                        contains_fish=new_fish,
                        contains_shellfish=new_shellfish,
                        is_available=True,
                        reviewed_by=selected_by,
                        review_reason=new_reason,
                        ingredient_notes=new_notes.strip() or None,
                    ),
                )
            except ValueError as exc:
                st.error(str(exc))
            else:
                st.success("Custom option created.")
                st.rerun()

    variant_id = st.selectbox(
        "Option",
        options=[row["id"] for row in rows],
        format_func=lambda row_id: next(
            f"{row['ingredient_flags_source']} | {row['caterer_name']} | {row['display_name']}"
            for row in rows
            if row["id"] == row_id
        ),
    )
    row = next(item for item in rows if item["id"] == variant_id)

    with st.container(border=True):
        st.markdown(f"### {row['display_name']}")
        st.caption(f"{row['caterer_name']} | Current source: {row['ingredient_flags_source']}")
        if row["has_no_declared_tags"]:
            st.warning("The source menu item had no declared GF/DF/NF/VO tags.")

        available = st.checkbox("Available to offer", value=row["is_available"])
        col_a, col_b, col_c, col_d, col_e = st.columns(5)
        gf = col_a.checkbox("GF", value=row["is_gluten_free"])
        df = col_b.checkbox("DF", value=row["is_dairy_free"])
        nf = col_c.checkbox("NF", value=row["is_nut_free"])
        vo = col_d.checkbox("Vegetarian option", value=row["is_vegetarian_option"])
        halal = col_e.checkbox("Halal", value=row["is_halal_inferred"])

        col_f, col_g, col_h, col_i, col_j = st.columns(5)
        contains_beef = col_f.checkbox("Contains beef", value=row["contains_beef"])
        contains_pork = col_g.checkbox("Contains pork", value=row["contains_pork"])
        contains_red_meat = col_h.checkbox("Contains red meat", value=row["contains_red_meat"])
        contains_fish = col_i.checkbox("Contains fish", value=row["contains_fish"])
        contains_shellfish = col_j.checkbox("Contains shellfish", value=row["contains_shellfish"])

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
                    variant_id,
                    DishReviewUpdate(
                        is_gluten_free=gf,
                        is_dairy_free=df,
                        is_nut_free=nf,
                        is_vegetarian_option=vo,
                        is_halal_inferred=halal,
                        contains_beef=contains_beef,
                        contains_pork=contains_pork,
                        contains_red_meat=contains_red_meat,
                        contains_fish=contains_fish,
                        contains_shellfish=contains_shellfish,
                        is_available=available,
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
