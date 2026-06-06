"""Supabase client factory.

The ingestion pipeline and validation jobs run with the service-role key,
which bypasses RLS. Never expose the service-role key to the operator UI.
"""

from __future__ import annotations

import os
from functools import cache

from dotenv import load_dotenv

from supabase import Client, create_client

load_dotenv()


def create_service_client() -> Client:
    """Create an independent service-role Supabase client."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. "
            "Set them in .env or export them before running."
        )
    return create_client(url, key)


@cache
def get_client() -> Client:
    """Return the cached service-role client used by request handlers."""
    return create_service_client()
