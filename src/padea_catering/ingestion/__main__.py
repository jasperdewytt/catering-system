"""CLI entry point: `uv run python -m padea_catering.ingestion`."""

from __future__ import annotations

import sys
from pathlib import Path

from ..db import get_client
from .pipeline import IngestionError, run_ingestion


def main() -> int:
    client = get_client()
    raw_dir = Path("data/raw")
    if not raw_dir.exists():
        print(f"error: {raw_dir} does not exist", file=sys.stderr)
        return 1
    try:
        report = run_ingestion(client, raw_dir)
    except IngestionError as exc:
        print(f"INGESTION FAILED: {exc}", file=sys.stderr)
        return 2

    print("=" * 60)
    print("Ingestion complete")
    print("=" * 60)
    print(f"schools                     : {report.schools}")
    print(f"school_aliases              : {report.school_aliases}")
    print(f"caterers                    : {report.caterers}")
    print(f"caterer_weekly_minimums     : {report.caterer_weekly_minimums}")
    print(f"caterer_contacts            : {report.caterer_contacts}")
    print(f"sessions                    : {report.sessions}")
    print(f"exclusions                  : {report.exclusions}")
    print(f"students                    : {report.students}")
    print(f"student_dietary_tags        : {report.student_dietary_tags}")
    print(f"student_dietary_warnings    : {report.student_dietary_warnings}")
    print(f"session_enrolments          : {report.session_enrolments}")
    print(f"dishes                      : {report.dishes}")
    print(f"absences                    : {report.absences}")
    if report.soft_duplicate_warnings:
        print()
        print("Soft duplicates needing operator review:")
        for w in report.soft_duplicate_warnings:
            print(f"  - {w}")
    if report.multi_session_same_date:
        print()
        print("Multi-session same-date conflicts (D-05):")
        for w in report.multi_session_same_date:
            print(f"  - {w}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
