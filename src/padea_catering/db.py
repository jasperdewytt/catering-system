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


@cache
def get_client() -> Client:
    """Return a service-role Supabase client.

    Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment
    (typically loaded from `.env`). Cached so repeated calls reuse the same
    underlying HTTP client.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. "
            "Set them in .env or export them before running."
        )
    return create_client(url, key)
