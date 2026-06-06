"""CLI for paste-in/stored caterer reply intake."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from padea_catering.db import get_client

from .handler import record_and_handle_caterer_reply


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Record and handle one caterer reply.")
    parser.add_argument("--order-run-id", required=True)
    parser.add_argument("--caterer-id", required=True)
    parser.add_argument("--raw-body-file", required=True)
    parser.add_argument("--communication-id")
    parser.add_argument("--subject")
    parser.add_argument("--from-email")
    parser.add_argument("--received-at")
    parser.add_argument("--provider-thread-id")
    parser.add_argument("--provider-message-id")
    parser.add_argument("--idempotency-key")
    parser.add_argument("--actor-name", default="Autopilot")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    raw_body = Path(args.raw_body_file).read_text(encoding="utf-8")
    result = record_and_handle_caterer_reply(
        get_client(),
        order_run_id=args.order_run_id,
        caterer_id=args.caterer_id,
        raw_body=raw_body,
        communication_id=args.communication_id,
        subject=args.subject,
        from_email=args.from_email,
        received_at=args.received_at,
        provider_thread_id=args.provider_thread_id,
        provider_message_id=args.provider_message_id,
        idempotency_key=args.idempotency_key,
        actor_name=args.actor_name,
    )
    print(
        json.dumps(
            {
                "reply_id": result["reply_id"],
                "ai_interpretation_id": result["ai_interpretation_id"],
                "parsed_intent": result["parsed_intent"],
                "handled_status": result["handled_status"],
                "exception_id": result["exception_id"],
                "summary": result["summary"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
