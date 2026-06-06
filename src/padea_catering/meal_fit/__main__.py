"""CLI entry point: `uv run python -m padea_catering.meal_fit`."""

from __future__ import annotations

import argparse
from datetime import date

from padea_catering.db import get_client

from .engine import build_preference_aware_order_plan, generate_preference_aware_order_run


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate preference-aware catering orders.")
    parser.add_argument("--week-start", required=True, help="Service week start date, YYYY-MM-DD.")
    parser.add_argument("--generated-by", default=None, help="Operator or process name for audit.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute the meal-fit plan and print counts without writing order tables.",
    )
    parser.add_argument(
        "--persist",
        action="store_true",
        help="Persist the generated meal-fit order run.",
    )
    args = parser.parse_args()

    week_start = date.fromisoformat(args.week_start)
    client = get_client()

    if args.dry_run:
        plan = build_preference_aware_order_plan(client, week_start)
        print("=" * 64)
        print("Meal-fit order generation dry run")
        print("=" * 64)
        print(f"service_week_start : {plan.service_week_start}")
        print(f"service_week_end   : {plan.service_week_end}")
        print("algorithm_version  : meal-fit-v1")
        print(f"scoring_version    : {plan.scoring_config.version}")
        print(f"offer_sets         : {len(plan.selected_offer_sets)}")
        print(f"allocations        : {len(plan.allocations)}")
        print(f"order_lines        : {0 if plan.has_blockers else len(plan.order_lines)}")
        print(f"fit_explanations   : {len(plan.explanations)}")
        print(f"issues             : {len(plan.issues)}")
        print(f"status             : {'blocked' if plan.has_blockers else 'generated'}")
        for selected in plan.selected_offer_sets:
            print(
                "[OFFER_SET] "
                f"caterer={selected.caterer_id} method={selected.method} "
                f"tier={selected.menu_item_count} demand={selected.projected_demand} "
                f"minimum={selected.minimum_meals} forced_waste={selected.forced_waste} "
                f"score={selected.score:.4f}"
            )
        for issue in plan.issues:
            print(f"[{issue.severity.upper()}] {issue.code}: {issue.message}")
        return 1 if plan.has_blockers else 0

    if not args.persist:
        parser.error("Use --dry-run to preview or --persist to write the order run.")

    result = generate_preference_aware_order_run(
        client,
        week_start,
        generated_by=args.generated_by,
    )
    print("=" * 64)
    print("Meal-fit order generation complete")
    print("=" * 64)
    for key, value in result.items():
        print(f"{key:20}: {value}")
    return 1 if result["status"] == "blocked" else 0


if __name__ == "__main__":
    raise SystemExit(main())
