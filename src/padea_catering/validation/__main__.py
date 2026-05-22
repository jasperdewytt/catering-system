"""CLI entry point: `uv run python -m padea_catering.validation`."""

from __future__ import annotations

from ..db import get_client
from .checks import ALL_CHECKS
from .framework import ValidationReport

_SEV_ORDER = {"error": 0, "warning": 1, "info": 2}
_SEV_GLYPH = {"error": "ERR ", "warning": "WARN", "info": "INFO"}


def main() -> int:
    client = get_client()
    report = ValidationReport()
    for check in ALL_CHECKS:
        report.add(*check(client))

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
