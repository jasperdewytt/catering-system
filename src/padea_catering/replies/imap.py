"""Backend-only Gmail IMAP polling for caterer replies."""

from __future__ import annotations

import email
import imaplib
import os
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from email.header import decode_header, make_header
from email.message import Message
from email.utils import parsedate_to_datetime
from typing import Any, Protocol

from supabase import Client

from .handler import (
    DEFAULT_ACTOR,
    TERMINAL_REPLY_STATUSES,
    _audit_reply_state,
    _blank_to_none,
    _clean_summary,
    _find_existing_reply,
    _insert_audit_log,
    _reply_idempotency_key,
    _select,
    _select_one,
    _utc_now_iso,
    handle_caterer_reply,
    record_and_handle_caterer_reply,
)

DEFAULT_IMAP_HOST = "imap.gmail.com"
DEFAULT_IMAP_PORT = 993
DEFAULT_IMAP_MAILBOX = "INBOX"
DEFAULT_IMAP_TIMEOUT_SECONDS = 30
DEFAULT_IMAP_MAX_MESSAGES = 10
DEFAULT_GMAIL_QUERY = "in:inbox newer_than:7d subject:Padea"
GMAIL_IMAP_PROVIDER = "gmail_imap"
TOKEN_RE = re.compile(r"\[Padea:([^:\]]+):([^\]]+)\]")
ProgressReporter = Callable[
    [str, str, int, dict[str, Any] | None, str | None],
    None,
]


class ImapConnection(Protocol):
    def login(self, username: str, password: str) -> Any: ...
    def select(self, mailbox: str) -> Any: ...
    def search(self, charset: str | None, *criteria: str) -> tuple[str, list[bytes]]: ...
    def fetch(self, message_set: bytes | str, message_parts: str) -> tuple[str, list[Any]]: ...
    def logout(self) -> Any: ...


@dataclass(frozen=True)
class ImapConfig:
    host: str
    port: int
    mailbox: str
    username: str
    app_password: str
    timeout_seconds: int = DEFAULT_IMAP_TIMEOUT_SECONDS
    max_messages: int = DEFAULT_IMAP_MAX_MESSAGES
    gmail_query: str = DEFAULT_GMAIL_QUERY


def imap_config_from_env() -> ImapConfig:
    return ImapConfig(
        host=os.environ.get("PADEA_REPLY_IMAP_HOST", "").strip() or DEFAULT_IMAP_HOST,
        port=int(os.environ.get("PADEA_REPLY_IMAP_PORT", "") or DEFAULT_IMAP_PORT),
        mailbox=os.environ.get("PADEA_REPLY_IMAP_MAILBOX", "").strip() or DEFAULT_IMAP_MAILBOX,
        username=_required_env("PADEA_GMAIL_SMTP_USERNAME"),
        app_password=_required_env("PADEA_GMAIL_SMTP_APP_PASSWORD"),
        timeout_seconds=int(
            os.environ.get("PADEA_REPLY_IMAP_TIMEOUT_SECONDS", "") or DEFAULT_IMAP_TIMEOUT_SECONDS
        ),
        max_messages=int(
            os.environ.get("PADEA_REPLY_IMAP_MAX_MESSAGES", "") or DEFAULT_IMAP_MAX_MESSAGES
        ),
        gmail_query=os.environ.get("PADEA_REPLY_IMAP_GMAIL_QUERY", "").strip()
        or DEFAULT_GMAIL_QUERY,
    )


def poll_gmail_caterer_replies(
    client: Client,
    *,
    actor_name: str | None = None,
    config: ImapConfig | None = None,
    imap_factory: Any | None = None,
    retry_delays: tuple[float, ...] = (2.0, 5.0, 8.0),
    sleep: Any = time.sleep,
    progress: ProgressReporter | None = None,
) -> dict[str, Any]:
    """Poll unread/recent Gmail replies and run deterministic reply handling."""
    actor_name = (actor_name or "").strip() or DEFAULT_ACTOR
    config = config or imap_config_from_env()
    imap_factory = imap_factory or imaplib.IMAP4_SSL
    processed: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    seen_imap_ids: set[str] = set()
    seen_provider_ids: set[str] = set()
    scanned_count = 0
    matched_count = 0
    already_seen_count = 0
    ignored_count = 0
    attempt_count = 0

    _report_progress(progress, "connecting", "Connecting to Gmail", 5)
    try:
        connection = imap_factory(config.host, config.port, timeout=config.timeout_seconds)
    except TypeError:
        connection = imap_factory(config.host, config.port)
    try:
        connection.login(config.username, config.app_password)
        for delay in (0.0, *retry_delays):
            if delay:
                _report_progress(
                    progress,
                    "waiting_retry",
                    f"Next Gmail check in {int(delay)} seconds",
                    min(80, 10 + attempt_count * 20),
                    {
                        "attempt": attempt_count,
                        "maximum_attempts": len(retry_delays) + 1,
                        "next_retry_seconds": int(delay),
                    },
                )
                sleep(delay)
            attempt_count += 1
            _report_progress(
                progress,
                "checking_gmail",
                f"Checking Gmail, attempt {attempt_count} of {len(retry_delays) + 1}",
                min(85, 10 + attempt_count * 20),
                {
                    "attempt": attempt_count,
                    "maximum_attempts": len(retry_delays) + 1,
                    "next_retry_seconds": 0,
                },
            )
            connection.select(config.mailbox)
            found_new_reply = False
            for message_id in _search_message_ids(
                connection,
                max_messages=config.max_messages,
                gmail_query=config.gmail_query,
            ):
                imap_id = _display_message_id(message_id)
                if imap_id in seen_imap_ids:
                    continue
                seen_imap_ids.add(imap_id)
                scanned_count += 1
                try:
                    message = _fetch_message(connection, message_id)
                    parsed = _parse_email_message(message, fallback_provider_id=str(message_id))
                    provider_message_id = parsed["provider_message_id"]
                    if provider_message_id in seen_provider_ids:
                        continue
                    seen_provider_ids.add(provider_message_id)
                    if not _is_probable_padea_reply(parsed):
                        continue
                    matched_count += 1
                    existing_key = _reply_idempotency_key(
                        order_run_id=parsed.get("order_run_id") or "unlinked",
                        caterer_id=parsed.get("caterer_id") or "unlinked",
                        subject=parsed["subject"],
                        raw_body=parsed["raw_body"],
                        provider_message_id=provider_message_id,
                        idempotency_key=None,
                    )
                    existing = _find_existing_reply(
                        client,
                        idempotency_key=existing_key,
                        provider_message_id=provider_message_id,
                    )
                    if existing:
                        if existing.get("handled_status") in TERMINAL_REPLY_STATUSES:
                            already_seen_count += 1
                            continue
                        found_new_reply = True
                        if _has_started_reply_revision(client, existing["id"]):
                            processed.append(
                                handle_caterer_reply(
                                    client,
                                    existing["id"],
                                    actor_name=actor_name,
                                )
                            )
                            continue
                        existing_link = _link_from_reply(existing)
                        if existing_link and _is_stale_linked_reply(client, existing_link):
                            _mark_reply_ignored(
                                client,
                                reply=existing,
                                summary=(
                                    "Ignored because a newer sent caterer communication exists "
                                    "for this week and caterer."
                                ),
                            )
                            ignored_count += 1
                            continue
                        processed.append(
                            handle_caterer_reply(
                                client,
                                existing["id"],
                                actor_name=actor_name,
                            )
                        )
                        continue

                    found_new_reply = True
                    link = _link_reply(client, parsed)
                    if link:
                        if _is_stale_linked_reply(client, link):
                            _record_ignored_stale_reply(
                                client,
                                parsed=parsed,
                                link=link,
                                actor_name=actor_name,
                            )
                            ignored_count += 1
                            continue
                        result = record_and_handle_caterer_reply(
                            client,
                            order_run_id=link["order_run_id"],
                            caterer_id=link["caterer_id"],
                            communication_id=link["communication_id"],
                            raw_body=parsed["raw_body"],
                            subject=parsed["subject"],
                            from_email=parsed["from_email"],
                            received_at=parsed["received_at"],
                            provider_thread_id=parsed["provider_thread_id"],
                            provider_message_id=provider_message_id,
                            in_reply_to_message_id=parsed["in_reply_to_message_id"],
                            reference_message_ids=parsed["reference_message_ids"],
                            actor_name=actor_name,
                            intake_provider=GMAIL_IMAP_PROVIDER,
                        )
                    else:
                        result = _record_unlinked_reply(
                            client,
                            parsed=parsed,
                            actor_name=actor_name,
                        )
                    processed.append(result)
                except Exception as exc:
                    failed.append({"message_id": imap_id, "error": str(exc)})
            if found_new_reply:
                break
    finally:
        try:
            connection.logout()
        except Exception:
            pass

    result = {
        "attempt_count": attempt_count,
        "scanned_count": scanned_count,
        "matched_count": matched_count,
        "already_seen_count": already_seen_count,
        "ignored_count": ignored_count,
        "processed_count": len(processed),
        "auto_handled_count": _count_status(processed, "auto_handled"),
        "auto_adjusted_count": _count_status(processed, "auto_adjusted"),
        "escalated_count": _count_status(processed, "escalated"),
        "failed_count": len(failed),
        "reply_ids": [row["reply_id"] for row in processed if row.get("reply_id")],
        "order_run_ids": _affected_order_run_ids(processed),
        "failed": failed,
    }
    _report_progress(
        progress,
        "processing_complete",
        "Reply check complete",
        99,
        {
            "attempt": attempt_count,
            "processed": len(processed),
            "auto_handled": result["auto_handled_count"],
            "auto_adjusted": result["auto_adjusted_count"],
            "escalated": result["escalated_count"],
            "failed": len(failed),
        },
    )
    return result


def _report_progress(
    progress: ProgressReporter | None,
    stage: str,
    label: str,
    percent: int,
    counters: dict[str, Any] | None = None,
    detail: str | None = None,
) -> None:
    if progress is not None:
        progress(stage, label, percent, counters, detail)


def _has_started_reply_revision(client: Client, caterer_reply_id: str) -> bool:
    return any(
        row.get("algorithm_version") == "reply-revision-v1"
        and (row.get("input_snapshot") or {}).get("caterer_reply_id") == caterer_reply_id
        for row in _select(client, "order_runs", "*")
    )


def _link_from_reply(reply: dict[str, Any]) -> dict[str, str] | None:
    if (
        not reply.get("communication_id")
        or not reply.get("order_run_id")
        or not reply.get("caterer_id")
    ):
        return None
    return {
        "communication_id": str(reply["communication_id"]),
        "order_run_id": str(reply["order_run_id"]),
        "caterer_id": str(reply["caterer_id"]),
    }


def _is_stale_linked_reply(client: Client, link: dict[str, str]) -> bool:
    try:
        linked_run = _select_one(client, "order_runs", link["order_run_id"])
    except ValueError:
        return False
    if linked_run.get("status") == "superseded":
        return True

    week_start = linked_run.get("service_week_start")
    if not week_start:
        return False

    linked_sort = _run_sort_value(linked_run)
    for run in _select(client, "order_runs", "*", service_week_start=week_start):
        if run.get("id") == link["order_run_id"]:
            continue
        if run.get("status") not in {"approved", "generated"}:
            continue
        if _run_sort_value(run) <= linked_sort:
            continue
        newer_sent = [
            row
            for row in _select(
                client,
                "order_communications",
                "*",
                order_run_id=run["id"],
                caterer_id=link["caterer_id"],
            )
            if row.get("status") == "sent"
        ]
        if newer_sent:
            return True
    return False


def _run_sort_value(run: dict[str, Any]) -> str:
    return str(run.get("generated_at") or run.get("created_at") or run.get("id") or "")


def _mark_reply_ignored(
    client: Client,
    *,
    reply: dict[str, Any],
    summary: str,
) -> dict[str, Any]:
    rows = (
        client.table("caterer_reply_intake")
        .update(
            {
                "handled_status": "ignored",
                "handled_at": _utc_now_iso(),
                "handling_summary": summary,
                "metadata": {
                    **(reply.get("metadata") or {}),
                    "ignore_reason": "stale_order_run_reply",
                },
            }
        )
        .eq("id", reply["id"])
        .execute()
        .data
    )
    return rows[0] if rows else reply


def _record_ignored_stale_reply(
    client: Client,
    *,
    parsed: dict[str, Any],
    link: dict[str, str],
    actor_name: str,
) -> dict[str, Any]:
    key = _reply_idempotency_key(
        order_run_id=link["order_run_id"],
        caterer_id=link["caterer_id"],
        subject=parsed["subject"],
        raw_body=parsed["raw_body"],
        provider_message_id=parsed["provider_message_id"],
        idempotency_key=None,
    )
    row = (
        client.table("caterer_reply_intake")
        .insert(
            {
                "communication_id": link["communication_id"],
                "order_run_id": link["order_run_id"],
                "caterer_id": link["caterer_id"],
                "provider": GMAIL_IMAP_PROVIDER,
                "provider_thread_id": parsed["provider_thread_id"],
                "provider_message_id": parsed["provider_message_id"],
                "in_reply_to_message_id": parsed["in_reply_to_message_id"],
                "reference_message_ids": parsed["reference_message_ids"],
                "from_email": parsed["from_email"],
                "subject": parsed["subject"],
                "raw_body": parsed["raw_body"],
                "received_at": parsed["received_at"],
                "parsed_intent": "unknown",
                "handled_status": "ignored",
                "handled_at": _utc_now_iso(),
                "handling_summary": (
                    "Ignored because a newer sent caterer communication exists for this week "
                    "and caterer."
                ),
                "metadata": {
                    "idempotency_key": key,
                    "intake_source": GMAIL_IMAP_PROVIDER,
                    "ignore_reason": "stale_order_run_reply",
                },
            }
        )
        .execute()
        .data[0]
    )
    _insert_audit_log(
        client,
        order_run_id=link["order_run_id"],
        actor_name=actor_name,
        action="caterer_reply_received",
        entity_type="caterer_reply",
        entity_id=row["id"],
        reason="Stale caterer reply received and ignored.",
        after_state=_audit_reply_state(row),
    )
    return row


def debug_gmail_reply_search(
    client: Client,
    *,
    config: ImapConfig | None = None,
    imap_factory: Any | None = None,
) -> dict[str, Any]:
    """Inspect likely reply messages without recording rows or calling Claude."""
    config = config or imap_config_from_env()
    imap_factory = imap_factory or imaplib.IMAP4_SSL

    try:
        connection = imap_factory(config.host, config.port, timeout=config.timeout_seconds)
    except TypeError:
        connection = imap_factory(config.host, config.port)

    try:
        connection.login(config.username, config.app_password)
        connection.select(config.mailbox)
        message_ids = _search_message_ids(
            connection,
            max_messages=config.max_messages,
            gmail_query=config.gmail_query,
        )
        candidates: list[dict[str, Any]] = []
        for message_id in message_ids:
            try:
                message = _fetch_headers(connection, message_id)
                parsed = _parse_header_message(message, fallback_provider_id=str(message_id))
                probable = _is_probable_padea_reply(parsed)
                link = _link_reply(client, {**parsed, "raw_body": ""}) if probable else None
                existing = _find_existing_reply(
                    client,
                    idempotency_key=_reply_idempotency_key(
                        order_run_id=(link or {}).get("order_run_id") or "unlinked",
                        caterer_id=(link or {}).get("caterer_id") or "unlinked",
                        subject=parsed["subject"],
                        raw_body="",
                        provider_message_id=parsed["provider_message_id"],
                        idempotency_key=None,
                    ),
                    provider_message_id=parsed["provider_message_id"],
                )
                candidates.append(
                    {
                        "imap_message_id": _display_message_id(message_id),
                        "provider_message_id": parsed["provider_message_id"],
                        "from_email": parsed["from_email"],
                        "subject": parsed["subject"],
                        "received_at": parsed["received_at"],
                        "probable_padea_reply": probable,
                        "link_status": "linked" if link else "unlinked",
                        "communication_id": (link or {}).get("communication_id"),
                        "order_run_id": (link or {}).get("order_run_id"),
                        "caterer_id": (link or {}).get("caterer_id"),
                        "already_seen": existing is not None,
                    }
                )
            except Exception as exc:
                candidates.append(
                    {
                        "imap_message_id": _display_message_id(message_id),
                        "error": str(exc),
                    }
                )
    finally:
        try:
            connection.logout()
        except Exception:
            pass

    return {
        "host": config.host,
        "mailbox": config.mailbox,
        "gmail_query": config.gmail_query,
        "max_messages": config.max_messages,
        "matched_message_count": len(candidates),
        "candidates": candidates,
    }


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(f"{name} is required for Gmail IMAP reply polling.")
    return value


def _search_message_ids(
    connection: ImapConnection,
    *,
    max_messages: int,
    gmail_query: str,
) -> list[bytes]:
    found = _gmail_raw_search(connection, gmail_query)
    if not found:
        found = _subject_search(connection, "Padea")
    return list(reversed(found))[: max(1, max_messages)]


def _gmail_raw_search(connection: ImapConnection, gmail_query: str) -> list[bytes]:
    if not gmail_query.strip():
        return []
    try:
        status, data = connection.search(None, "X-GM-RAW", _quoted_imap_text(gmail_query))
    except Exception:
        return []
    if status != "OK" or not data:
        return []
    return _split_message_ids(data)


def _subject_search(connection: ImapConnection, subject_term: str) -> list[bytes]:
    found: list[bytes] = []
    for criterion in (("UNSEEN", "SUBJECT", subject_term), ("RECENT", "SUBJECT", subject_term)):
        status, data = connection.search(None, *criterion)
        if status != "OK" or not data:
            continue
        for message_id in _split_message_ids(data):
            if message_id not in found:
                found.append(message_id)
    return found


def _split_message_ids(data: list[bytes]) -> list[bytes]:
    message_ids: list[bytes] = []
    for item in data:
        message_ids.extend(item.split())
    return message_ids


def _quoted_imap_text(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _fetch_message(connection: ImapConnection, message_id: bytes) -> Message:
    status, data = connection.fetch(message_id, "(BODY.PEEK[])")
    if status != "OK":
        raise ValueError(f"IMAP fetch failed for message {message_id!r}.")
    for item in data:
        if isinstance(item, tuple) and len(item) >= 2:
            return email.message_from_bytes(item[1])
    raise ValueError(f"IMAP fetch did not return RFC822 content for message {message_id!r}.")


def _fetch_headers(connection: ImapConnection, message_id: bytes) -> Message:
    status, data = connection.fetch(message_id, "(BODY.PEEK[HEADER])")
    if status != "OK":
        raise ValueError(f"IMAP header fetch failed for message {message_id!r}.")
    for item in data:
        if isinstance(item, tuple) and len(item) >= 2:
            return email.message_from_bytes(item[1])
    raise ValueError(f"IMAP fetch did not return headers for message {message_id!r}.")


def _parse_email_message(message: Message, *, fallback_provider_id: str) -> dict[str, Any]:
    provider_message_id = (
        _blank_to_none(str(message.get("Message-ID") or "")) or fallback_provider_id
    )
    received_at = _message_date(message) or _utc_now_iso()
    return {
        "provider_message_id": provider_message_id,
        "provider_thread_id": _blank_to_none(str(message.get("Thread-ID") or "")),
        "subject": _decode_header_value(message.get("Subject")),
        "from_email": _decode_header_value(message.get("From")),
        "received_at": received_at,
        "raw_body": _message_text_body(message),
        "reference_message_ids": _extract_message_ids(message.get("References")),
        "in_reply_to_message_id": _first_message_id(message.get("In-Reply-To")),
    }


def _parse_header_message(message: Message, *, fallback_provider_id: str) -> dict[str, Any]:
    provider_message_id = (
        _blank_to_none(str(message.get("Message-ID") or "")) or fallback_provider_id
    )
    received_at = _message_date(message) or _utc_now_iso()
    return {
        "provider_message_id": provider_message_id,
        "provider_thread_id": _blank_to_none(str(message.get("Thread-ID") or "")),
        "subject": _decode_header_value(message.get("Subject")),
        "from_email": _decode_header_value(message.get("From")),
        "received_at": received_at,
        "reference_message_ids": _extract_message_ids(message.get("References")),
        "in_reply_to_message_id": _first_message_id(message.get("In-Reply-To")),
    }


def _is_probable_padea_reply(parsed: dict[str, Any]) -> bool:
    searchable_text = " ".join(
        [
            str(parsed.get("subject") or ""),
            " ".join(parsed.get("reference_message_ids") or []),
            str(parsed.get("in_reply_to_message_id") or ""),
        ]
    )
    return (
        bool(TOKEN_RE.search(searchable_text)) or "padea catering order" in searchable_text.lower()
    )


def _link_reply(client: Client, parsed: dict[str, Any]) -> dict[str, str] | None:
    in_reply_to = str(parsed.get("in_reply_to_message_id") or "").strip()
    if in_reply_to:
        match = _communication_by_outbound_message_id(client, in_reply_to)
        if match:
            return _communication_link(match)

    for reference_message_id in reversed(parsed.get("reference_message_ids") or []):
        match = _communication_by_outbound_message_id(client, str(reference_message_id))
        if match:
            return _communication_link(match)

    token_text = " ".join(
        [
            str(parsed.get("subject") or ""),
            " ".join(parsed.get("reference_message_ids") or []),
            str(parsed.get("in_reply_to_message_id") or ""),
            str(parsed.get("raw_body") or ""),
        ]
    )
    token_match = TOKEN_RE.search(token_text)
    if token_match:
        order_run_id, caterer_id = token_match.groups()
        communications = _select(
            client,
            "order_communications",
            "*",
            order_run_id=order_run_id,
            caterer_id=caterer_id,
        )
        if communications:
            return _communication_link(communications[0])

    normalized_subject = _normalize_subject(str(parsed.get("subject") or ""))
    if not normalized_subject:
        return None
    matches = [
        row
        for row in _select(client, "order_communications")
        if row.get("status") == "sent"
        and _normalize_subject(str(row.get("subject") or "")) == normalized_subject
    ]
    if len(matches) == 1:
        return _communication_link(matches[0])
    return None


def _communication_by_outbound_message_id(
    client: Client,
    message_id: str,
) -> dict[str, Any] | None:
    matches = _select(
        client,
        "order_communications",
        "*",
        outbound_message_id=message_id,
    )
    return matches[0] if len(matches) == 1 else None


def _communication_link(row: dict[str, Any]) -> dict[str, str]:
    return {
        "communication_id": str(row["id"]),
        "order_run_id": str(row["order_run_id"]),
        "caterer_id": str(row["caterer_id"]),
    }


def _record_unlinked_reply(
    client: Client,
    *,
    parsed: dict[str, Any],
    actor_name: str,
) -> dict[str, Any]:
    key = _reply_idempotency_key(
        order_run_id="unlinked",
        caterer_id="unlinked",
        subject=parsed["subject"],
        raw_body=parsed["raw_body"],
        provider_message_id=parsed["provider_message_id"],
        idempotency_key=None,
    )
    existing = _find_existing_reply(
        client,
        idempotency_key=key,
        provider_message_id=parsed["provider_message_id"],
    )
    if existing:
        return {
            "reply_id": existing["id"],
            "ai_interpretation_id": existing.get("ai_interpretation_id"),
            "parsed_intent": existing.get("parsed_intent"),
            "handled_status": existing.get("handled_status"),
            "exception_id": None,
            "summary": existing.get("handling_summary") or "",
            "reply": existing,
            "exception": None,
        }

    row = (
        client.table("caterer_reply_intake")
        .insert(
            {
                "provider": GMAIL_IMAP_PROVIDER,
                "provider_thread_id": parsed["provider_thread_id"],
                "provider_message_id": parsed["provider_message_id"],
                "in_reply_to_message_id": parsed["in_reply_to_message_id"],
                "reference_message_ids": parsed["reference_message_ids"],
                "from_email": parsed["from_email"],
                "subject": parsed["subject"],
                "raw_body": parsed["raw_body"],
                "received_at": parsed["received_at"],
                "parsed_intent": "unknown",
                "handled_status": "escalated",
                "handled_at": _utc_now_iso(),
                "handling_summary": "Caterer reply could not be linked to a sent communication.",
                "metadata": {
                    "idempotency_key": key,
                    "intake_source": GMAIL_IMAP_PROVIDER,
                    "link_status": "unlinked",
                },
            }
        )
        .execute()
        .data[0]
    )
    _insert_audit_log(
        client,
        order_run_id=None,
        actor_name=actor_name,
        action="caterer_reply_received",
        entity_type="caterer_reply",
        entity_id=row["id"],
        reason="Unlinked caterer reply received from Gmail IMAP.",
        after_state=_audit_reply_state(row),
    )
    return {
        "reply_id": row["id"],
        "ai_interpretation_id": None,
        "parsed_intent": "unknown",
        "handled_status": "escalated",
        "exception_id": None,
        "summary": _clean_summary(row["handling_summary"]),
        "reply": row,
        "exception": None,
    }


def _message_date(message: Message) -> str | None:
    value = message.get("Date")
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).isoformat()
    except (TypeError, ValueError):
        return None


def _decode_header_value(value: str | None) -> str | None:
    if value is None:
        return None
    return str(make_header(decode_header(value)))


def _extract_message_ids(value: str | None) -> list[str]:
    decoded = _decode_header_value(value) or ""
    matches = re.findall(r"<[^<>\\s]+>", decoded)
    if matches:
        return list(dict.fromkeys(matches))
    return [part for part in decoded.split() if part]


def _first_message_id(value: str | None) -> str | None:
    message_ids = _extract_message_ids(value)
    return message_ids[0] if message_ids else None


def _message_text_body(message: Message) -> str:
    if message.is_multipart():
        for part in message.walk():
            if part.get_content_maintype() == "multipart":
                continue
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                if payload is not None:
                    return payload.decode(part.get_content_charset() or "utf-8", errors="replace")
    payload = message.get_payload(decode=True)
    if payload is None:
        payload_value = message.get_payload()
        return str(payload_value or "")
    return payload.decode(message.get_content_charset() or "utf-8", errors="replace")


def _normalize_subject(value: str) -> str:
    cleaned = re.sub(r"^\s*(re|fw|fwd)\s*:\s*", "", value.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.lower()


def _count_status(rows: list[dict[str, Any]], status: str) -> int:
    return len([row for row in rows if row.get("handled_status") == status])


def _affected_order_run_ids(rows: list[dict[str, Any]]) -> list[str]:
    order_run_ids: set[str] = set()
    for row in rows:
        reply = row.get("reply") or {}
        if reply.get("order_run_id"):
            order_run_ids.add(str(reply["order_run_id"]))
        revised_id = (reply.get("metadata") or {}).get("revised_order_run_id")
        if revised_id:
            order_run_ids.add(str(revised_id))
    return sorted(order_run_ids)


def _display_message_id(message_id: bytes | str) -> str:
    if isinstance(message_id, bytes):
        return message_id.decode("utf-8", errors="replace")
    return str(message_id)


__all__ = [
    "GMAIL_IMAP_PROVIDER",
    "ImapConfig",
    "debug_gmail_reply_search",
    "imap_config_from_env",
    "poll_gmail_caterer_replies",
]
