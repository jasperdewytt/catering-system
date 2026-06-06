"""Run the persistent automation worker."""

from __future__ import annotations

import argparse

from .worker import run_forever, run_once


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Padea durable automation jobs.")
    parser.add_argument("--once", action="store_true", help="Claim at most one job and exit.")
    parser.add_argument("--poll-seconds", type=float, default=1.0)
    args = parser.parse_args()
    if args.once:
        run_once()
        return
    run_forever(poll_seconds=args.poll_seconds)


if __name__ == "__main__":
    main()
