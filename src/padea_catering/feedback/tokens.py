"""Signed feedback link tokens."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
from uuid import UUID


def _secret() -> bytes:
    value = os.environ.get("PADEA_FEEDBACK_LINK_SECRET", "").strip()
    if not value:
        value = os.environ.get("PADEA_BACKEND_SHARED_SECRET", "").strip()
    if not value:
        raise ValueError("PADEA_FEEDBACK_LINK_SECRET is required for feedback links.")
    return value.encode("utf-8")


def sign_feedback_request(request_id: str) -> str:
    """Return a URL-safe token containing the request id and HMAC signature."""
    canonical = str(UUID(request_id))
    digest = hmac.new(_secret(), canonical.encode("ascii"), hashlib.sha256).digest()
    signature = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return f"{canonical}.{signature}"


def verify_feedback_token(token: str) -> str:
    """Return the request id when the token is well-formed and correctly signed."""
    request_id, separator, signature = token.partition(".")
    if not separator or not signature:
        raise ValueError("Feedback link is invalid.")
    canonical = str(UUID(request_id))
    expected = sign_feedback_request(canonical).split(".", 1)[1]
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Feedback link is invalid.")
    return canonical
