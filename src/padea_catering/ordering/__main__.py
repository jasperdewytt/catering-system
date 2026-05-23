"""CLI entry point: `uv run python -m padea_catering.ordering`."""

from __future__ import annotations

import argparse
from datetime import date

from ..db import get_client
from .generator import build_order_plan, generate_order_run


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate deterministic catering orders.")
    parser.add_argument("--week-start", required=True, help="Service week start date, YYYY-MM-DD.")
    parser.add_argument("--generated-by", default=None, help="Operator or process name for audit.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute the plan and print counts without writing order tables.",
    )
    args = parser.parse_args()

    week_start = date.fromisoformat(args.week_start)
    client = get_client()

    if args.dry_run:
        plan = build_order_plan(client, week_start)
        print("=" * 64)
        print("Order generation dry run")
        print("=" * 64)
        print(f"service_week_start : {plan.service_week_start}")
        print(f"service_week_end   : {plan.service_week_end}")
        print(f"allocations        : {len(plan.allocations)}")
        print(f"order_lines        : {0 if plan.has_blockers else len(plan.order_lines)}")
        print(f"issues             : {len(plan.issues)}")
        print(f"status             : {'blocked' if plan.has_blockers else 'generated'}")
        for issue in plan.issues:
            print(f"[{issue.severity.upper()}] {issue.code}: {issue.message}")
        return 1 if plan.has_blockers else 0

    result = generate_order_run(client, week_start, generated_by=args.generated_by)
    print("=" * 64)
    print("Order generation complete")
    print("=" * 64)
    for key, value in result.items():
        print(f"{key:16}: {value}")
    return 1 if result["status"] == "blocked" else 0


if __name__ == "__main__":
    raise SystemExit(main())
