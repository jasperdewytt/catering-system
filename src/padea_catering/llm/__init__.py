"""Backend-only advisory LLM helpers."""

from .actions import (
    explain_autopilot_exception,
    interpret_caterer_reply,
    interpret_dish_variant_tags,
    interpret_exception_resolution,
    interpret_manager_feedback,
    interpret_student_feedback,
)
from .providers import (
    AnthropicClaudeProvider,
    FakeLLMProvider,
    LLMCompletion,
    LLMProvider,
    LLMProviderError,
)

__all__ = [
    "AnthropicClaudeProvider",
    "FakeLLMProvider",
    "LLMCompletion",
    "LLMProvider",
    "LLMProviderError",
    "explain_autopilot_exception",
    "interpret_caterer_reply",
    "interpret_dish_variant_tags",
    "interpret_exception_resolution",
    "interpret_manager_feedback",
    "interpret_student_feedback",
]
