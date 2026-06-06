"""CLI entry point: `uv run python -m padea_catering.demo_seed`."""

from __future__ import annotations

import argparse
from datetime import date

from ..db import get_client
from . import apply_demo_seed_plan, build_demo_seed_plan, describe_plan


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed deterministic final-round demo data.")
    parser.add_argument("--week-start", required=True, help="Service week start date, YYYY-MM-DD.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build and print the seed plan without writing to Supabase.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Remove prior Stage 3 demo rows before applying the deterministic seed.",
    )
    args = parser.parse_args()

    week_start = date.fromisoformat(args.week_start)
    client = get_client()
    plan = build_demo_seed_plan(client, week_start)

    print(describe_plan(plan))
    if args.dry_run:
        print("\nDry run only: no rows were written.")
        return 0

    apply_demo_seed_plan(client, plan, reset=args.reset)
    print("\nDemo seed data applied.")
    if args.reset:
        print("Prior demo rows were reset before insert/upsert.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
