"""Narrow Streamlit MVP for read-only generated order review.

This is intentionally separate from the future full operator app.
Run with:
    uv run streamlit run app/order_review_mvp.py
"""

from __future__ import annotations

import pandas as pd
import streamlit as st

from padea_catering.db import get_client
from padea_catering.operations import approve_order_run, unapprove_order_run
from padea_catering.order_review import (
    format_money,
    get_order_review,
    get_order_runs,
    select_default_order_run_id,
)

st.set_page_config(page_title="Padea Order Review MVP", layout="wide")

REVIEW_CACHE_VERSION = 2


@st.cache_resource
def _client():
    return get_client()


@st.cache_data(ttl=60, show_spinner=False)
def _cached_order_runs() -> list[dict]:
    return get_order_runs(_client())


@st.cache_data(ttl=60, show_spinner=False)
def _cached_order_review(order_run_id: str, cache_version: int) -> dict:
    _ = cache_version
    return get_order_review(_client(), order_run_id)


def _run_label(run: dict) -> str:
    return (
        f"{run['status']} | {run['service_week_start']} | "
        f"{run.get('generated_at') or run.get('created_at')} | {run['id']}"
    )


def _order_lines_table(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "caterer": row["caterer_name"],
                "school": row["school_name"],
                "date": row["session_date"],
                "dinner": row["dinner_time"],
                "option": row["variant_name"],
                "qty": row["quantity"],
                "unit": row["unit_price"],
                "line total": row["line_total"],
                "GST incl": row["gst_inclusive"],
            }
            for row in rows
        ]
    )


def _delivery_table(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "caterer": row["caterer_name"],
                "school": row["school_name"],
                "date": row["session_date"],
                "dinner": row["dinner_time"],
                "building": row["building"],
                "room": row["room"],
                "missing room": row["missing_room"],
                "manager": row["manager_name"],
                "mobile": row["manager_mobile"],
            }
            for row in rows
        ]
    )


def _allocation_table(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "caterer": row["caterer_name"],
                "school": row["school_name"],
                "date": row["session_date"],
                "student": row["student_name"],
                "year": row["year_level"],
                "status": row["status"],
                "reason": ", ".join(row["reason_codes"]),
                "dietary": ", ".join(row["dietary_tag_codes"]),
            }
            for row in rows
        ]
    )


def _contacts_table(contacts: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "role": row["role"],
                "name": row["display_name"],
                "email": row["email"],
                "cc": row["cc_preference"],
                "verified": row["is_verified"],
                "warning": row["warning"],
            }
            for row in contacts
        ]
    )


def _audit_table(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "time": row["created_at"],
                "actor": row["actor_name"],
                "action": row["action"],
                "entity": row["entity_type"],
                "reason": row["reason"],
            }
            for row in rows
        ]
    )


def render_overview(review: dict) -> None:
    run = review["run"]
    total_meals = sum(row["quantity"] for row in review["order_lines"])
    subtotal = sum(row["line_total_cents"] for row in review["order_lines"])
    skipped = sum(
        count
        for status, count in review["allocation_counts"].items()
        if status.startswith("skipped_")
    )

    cols = st.columns(5)
    cols[0].metric("Status", run["status"])
    cols[1].metric("Order lines", len(review["order_lines"]))
    cols[2].metric("Meals", total_meals)
    cols[3].metric("Item subtotal", format_money(subtotal))
    cols[4].metric("Skipped", skipped)

    if run["status"] != "generated":
        st.info("Drafts are available for generated and approved runs.")
    if review["issues"]:
        st.error(f"{len(review['issues'])} allocation issue(s) are attached to this run.")

    st.dataframe(
        pd.DataFrame(
            [
                {
                    "caterer": summary["caterer"]["name"],
                    "meals": summary["meal_count"],
                    "item subtotal": format_money(summary["subtotal_cents"]),
                    "delivery fee": format_money(summary["caterer"]["delivery_fee_cents"]),
                    "delivery scope": summary["caterer"]["delivery_scope"],
                    "GST inclusive": summary["caterer"]["gst_inclusive"],
                }
                for summary in review["caterer_summaries"].values()
            ]
        ),
        width="stretch",
        hide_index=True,
    )


def render_order_lines(review: dict) -> None:
    for caterer_name, rows in _group_by(review["order_lines"], "caterer_name").items():
        st.markdown(f"### {caterer_name}")
        for session_key, session_rows in _group_by_session(rows).items():
            st.caption(session_key)
            st.dataframe(_order_lines_table(session_rows), width="stretch", hide_index=True)


def render_allocations(review: dict) -> None:
    counts = pd.DataFrame(
        [
            {"status": status, "count": count}
            for status, count in review["allocation_counts"].items()
        ]
    )
    st.dataframe(counts, width="stretch", hide_index=True)

    skipped = [row for row in review["allocations"] if row["status"].startswith("skipped_")]
    with st.expander(f"Skipped student detail ({len(skipped)})", expanded=False):
        st.dataframe(_allocation_table(skipped), width="stretch", hide_index=True)


def render_contacts_delivery(review: dict) -> None:
    st.subheader("Delivery")
    st.dataframe(_delivery_table(review["session_delivery"]), width="stretch", hide_index=True)

    st.subheader("Contacts")
    for caterer_id, summary in review["caterer_summaries"].items():
        st.markdown(f"### {summary['caterer']['name']}")
        contacts = review["contacts_by_caterer"].get(caterer_id, [])
        if contacts:
            st.dataframe(_contacts_table(contacts), width="stretch", hide_index=True)
        else:
            st.warning("No contacts recorded.")


def render_email_drafts(review: dict) -> None:
    if review["run"]["status"] not in {"generated", "approved"} or review["issues"]:
        st.warning(
            "Drafts are suppressed unless the selected run is generated or approved with no issues."
        )
        return
    for caterer_id, summary in review["caterer_summaries"].items():
        caterer_name = summary["caterer"]["name"]
        draft = review["email_drafts"][caterer_id]
        st.markdown(f"### {caterer_name}")
        st.text_area("Draft", value=draft, height=420, key=f"draft-{caterer_id}")
        st.download_button(
            "Download draft",
            data=draft,
            file_name=f"{caterer_name.lower().replace(' ', '-')}-order-draft.txt",
            mime="text/plain",
            key=f"download-{caterer_id}",
        )


def render_approval(review: dict) -> None:
    run = review["run"]
    st.subheader("Approval")
    st.caption("Phase 3 MVP: status-changing actions require actor, reason, and audit log.")

    cols = st.columns(3)
    cols[0].metric("Status", run["status"])
    cols[1].metric("Approved by", run.get("approved_by") or "not approved")
    cols[2].metric("Approved at", run.get("approved_at") or "-")
    if run.get("approval_note"):
        st.info(run["approval_note"])

    with st.form("approval-form"):
        actor = st.text_input("Actor name")
        reason = st.text_area("Reason / approval note")
        if run["status"] == "generated":
            submitted = st.form_submit_button("Approve generated run")
            action = "approve"
        elif run["status"] == "approved":
            submitted = st.form_submit_button("Reopen approved run")
            action = "reopen"
        else:
            submitted = st.form_submit_button("No action available", disabled=True)
            action = "none"

    if submitted and action != "none":
        try:
            if action == "approve":
                approve_order_run(_client(), run["id"], actor, reason)
            else:
                unapprove_order_run(_client(), run["id"], actor, reason)
        except ValueError as exc:
            st.error(str(exc))
        else:
            st.cache_data.clear()
            st.success("Order run status updated and audit log written.")
            st.rerun()

    st.subheader("Audit history")
    audit_history = review.get("audit_history", [])
    if audit_history:
        st.dataframe(_audit_table(audit_history), width="stretch", hide_index=True)
    else:
        st.info("No audit history recorded for this order run.")


def _group_by(rows: list[dict], key: str) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row[key], []).append(row)
    return grouped


def _group_by_session(rows: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        label = (
            f"{row['school_name']} | {row['session_date']} | dinner {row['dinner_time'] or 'TBC'} "
            f"| {row['building'] or 'location TBC'}"
        )
        grouped.setdefault(label, []).append(row)
    return grouped


def main() -> None:
    st.title("Order Review MVP")
    st.caption(
        "Temporary read-only UI for reviewing generated orders and preparing copy-ready drafts. "
        "Approval is audited; no sending, manual override application, "
        "or LLM review is performed here."
    )

    runs = _cached_order_runs()
    if not runs:
        st.info("No order runs found. Generate an order run before opening this MVP.")
        return

    default_id = select_default_order_run_id(runs)
    run_by_id = {row["id"]: row for row in runs}
    with st.sidebar:
        st.header("Run")
        selected_run_id = st.selectbox(
            "Order run",
            options=[row["id"] for row in runs],
            index=[row["id"] for row in runs].index(default_id) if default_id else 0,
            format_func=lambda run_id: _run_label(run_by_id[run_id]),
        )
        if st.button("Refresh"):
            st.cache_data.clear()
            st.rerun()

    review = _cached_order_review(selected_run_id, REVIEW_CACHE_VERSION)
    run = review["run"]
    st.caption(
        f"Week {run['service_week_start']} to {run['service_week_end']} | "
        f"generated by {run.get('generated_by') or 'unknown'} | "
        f"algorithm {run['algorithm_version']}"
    )

    tab_overview, tab_lines, tab_allocations, tab_delivery, tab_drafts, tab_approval = st.tabs(
        [
            "Overview",
            "Order lines",
            "Allocations",
            "Contacts & delivery",
            "Email drafts",
            "Approval",
        ]
    )
    with tab_overview:
        render_overview(review)
    with tab_lines:
        render_order_lines(review)
    with tab_allocations:
        render_allocations(review)
    with tab_delivery:
        render_contacts_delivery(review)
    with tab_drafts:
        render_email_drafts(review)
    with tab_approval:
        render_approval(review)


if __name__ == "__main__":
    main()
