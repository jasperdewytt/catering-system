"""CLI entry point: `uv run python -m padea_catering.autopilot`."""

from __future__ import annotations

import argparse
from datetime import date

from padea_catering.db import get_client

from .runner import run_week_autopilot


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the idempotent catering autopilot.")
    parser.add_argument("--week-start", required=True, help="Service week start date, YYYY-MM-DD.")
    parser.add_argument(
        "--trigger-source",
        default="manual_demo",
        choices=("scheduled", "manual_demo", "retry"),
        help="Source that requested the autopilot run.",
    )
    parser.add_argument("--idempotency-key", default=None, help="Override idempotency key.")
    parser.add_argument(
        "--requested-by", default=None, help="Operator or process requesting the run."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Evaluate validation gates and meal-fit planning without writing or sending.",
    )
    args = parser.parse_args()

    result = run_week_autopilot(
        get_client(),
        date.fromisoformat(args.week_start),
        trigger_source=args.trigger_source,
        idempotency_key=args.idempotency_key,
        requested_by=args.requested_by,
        dry_run=args.dry_run,
    )

    print("=" * 64)
    print("Catering autopilot")
    print("=" * 64)
    print(f"autopilot_run_id     : {result.get('autopilot_run_id') or '[dry-run]'}")
    print(f"status               : {result['status']}")
    print(f"order_run_id         : {result.get('order_run_id') or '-'}")
    print(f"exception_count      : {result['exception_count']}")
    print(f"emails_prepared_count: {result['emails_prepared_count']}")
    print(f"emails_sent_count    : {result['emails_sent_count']}")
    print(f"summary              : {result['summary']}")
    return 0 if result["status"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
