"""CLI entry point: `uv run python -m padea_catering.validation`."""

from __future__ import annotations

import argparse
from datetime import date

from ..db import get_client
from .checks import run_all_checks
from .framework import ValidationReport

_SEV_ORDER = {"error": 0, "warning": 1, "info": 2}
_SEV_GLYPH = {"error": "ERR ", "warning": "WARN", "info": "INFO"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Run catering preflight validation.")
    parser.add_argument(
        "--week-start",
        help="Service week start date, YYYY-MM-DD. Defaults to earliest session date.",
    )
    args = parser.parse_args()

    client = get_client()
    week_start = date.fromisoformat(args.week_start) if args.week_start else None
    report = ValidationReport()
    report.add(*run_all_checks(client, week_start))

    print("=" * 64)
    print("Preflight validation report")
    print("=" * 64)
    print(
        f"{report.error_count} error(s), "
        f"{report.warning_count} warning(s), "
        f"{report.info_count} info."
    )
    print()

    by_cat = report.by_category()
    for category in sorted(by_cat):
        items = sorted(by_cat[category], key=lambda f: _SEV_ORDER[f.severity])
        print(f"### {category} ({len(items)})")
        for f in items:
            print(f"  [{_SEV_GLYPH[f.severity]}] {f.message}")
        print()

    # Exit non-zero if any errors. Warnings/info are reportable but non-blocking.
    return 1 if report.error_count else 0


if __name__ == "__main__":
    raise SystemExit(main())
