"""CLI for diagnosing Gmail reply search without invoking Claude."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence

from dotenv import load_dotenv

from padea_catering.db import get_client

from .imap import debug_gmail_reply_search, imap_config_from_env


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Inspect Gmail IMAP reply candidates without recording or parsing replies."
    )
    parser.add_argument("--query", help="Override PADEA_REPLY_IMAP_GMAIL_QUERY for this run.")
    parser.add_argument("--max-messages", type=int, help="Maximum candidate headers to inspect.")
    parser.add_argument("--mailbox", help="Override PADEA_REPLY_IMAP_MAILBOX for this run.")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    load_dotenv()
    args = build_parser().parse_args(argv)
    config = imap_config_from_env()
    if args.query:
        config = config.__class__(**{**config.__dict__, "gmail_query": args.query})
    if args.max_messages:
        config = config.__class__(**{**config.__dict__, "max_messages": args.max_messages})
    if args.mailbox:
        config = config.__class__(**{**config.__dict__, "mailbox": args.mailbox})

    print(
        json.dumps(
            debug_gmail_reply_search(get_client(), config=config),
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
