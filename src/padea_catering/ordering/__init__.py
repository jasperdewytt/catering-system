"""Deterministic order generation.

Entry point: `uv run python -m padea_catering.ordering`.
"""

from .generator import build_order_plan, generate_order_run

__all__ = ["build_order_plan", "generate_order_run"]
