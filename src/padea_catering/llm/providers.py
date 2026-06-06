"""Provider boundary for backend-only LLM calls."""

from __future__ import annotations

import os
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Protocol

from pydantic import BaseModel


@dataclass(frozen=True)
class LLMCompletion:
    """Raw provider output plus provider-level generation metadata."""

    raw_output: str
    metadata: dict[str, Any]
    structured_output: bool = False


class LLMProviderError(RuntimeError):
    """Raised when a provider cannot return a complete usable response."""


class LLMProvider(Protocol):
    """Small protocol for text-in, text-out advisory LLM calls."""

    provider_name: str
    model: str

    def complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
    ) -> LLMCompletion:
        """Return a raw model response."""


@dataclass
class FakeLLMProvider:
    """Deterministic provider used by tests and demos."""

    responses: list[str]
    model: str = "fake-llm"
    provider_name: str = "fake"

    def __post_init__(self) -> None:
        self.prompts: list[dict[str, str]] = []
        self._remaining = list(self.responses)

    def complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
    ) -> LLMCompletion:
        self.prompts.append({"system_prompt": system_prompt, "user_prompt": user_prompt})
        if not self._remaining:
            raise RuntimeError("FakeLLMProvider has no remaining responses.")
        return LLMCompletion(
            raw_output=self._remaining.pop(0),
            metadata={"output_mode": "provider_neutral_text"},
        )


class AnthropicClaudeProvider:
    """Anthropic Claude provider using backend-only environment credentials."""

    provider_name = "anthropic"
    MODEL_ALIASES = {
        "sonnet": "claude-sonnet-4-6",
        "claude-sonnet": "claude-sonnet-4-6",
        "haiku": "claude-haiku-4-5-20251001",
    }

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        max_tokens: int = 1200,
        temperature: float = 0.0,
    ) -> None:
        api_key = api_key.strip()
        model = self.MODEL_ALIASES.get(model.strip(), model.strip())
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for Claude integration.")
        if not model:
            raise ValueError("PADEA_CLAUDE_MODEL is required for Claude integration.")
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        try:
            from anthropic import Anthropic
        except ImportError as exc:
            raise RuntimeError("Install the anthropic package to use Claude integration.") from exc

        self._client = Anthropic(api_key=api_key)

    @classmethod
    def from_env(cls) -> AnthropicClaudeProvider:
        return cls(
            api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
            model=os.environ.get("PADEA_CLAUDE_MODEL", ""),
        )

    def complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
    ) -> LLMCompletion:
        schema = _anthropic_json_schema(response_model)
        try:
            message = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                output_config={
                    "format": {
                        "type": "json_schema",
                        "schema": schema,
                    }
                },
            )
        except Exception as exc:
            raise LLMProviderError(f"Anthropic structured generation failed: {exc}") from exc

        stop_reason = str(getattr(message, "stop_reason", "") or "")
        raw_output = "\n".join(_text_blocks(message.content)).strip()
        if stop_reason != "end_turn":
            raise LLMProviderError(
                f"Anthropic structured generation stopped with reason {stop_reason or 'unknown'}."
            )
        if not raw_output:
            raise LLMProviderError("Anthropic structured generation returned no content.")
        return LLMCompletion(
            raw_output=raw_output,
            structured_output=True,
            metadata={
                "output_mode": "anthropic_json_schema",
                "provider_model": str(getattr(message, "model", "") or self.model),
                "stop_reason": stop_reason,
                "schema_name": response_model.__name__,
            },
        )


def _text_blocks(blocks: Iterable[object]) -> list[str]:
    texts: list[str] = []
    for block in blocks:
        text = getattr(block, "text", None)
        if text is not None:
            texts.append(str(text))
            continue
        if isinstance(block, dict) and block.get("text") is not None:
            texts.append(str(block["text"]))
    return texts


def _anthropic_json_schema(response_model: type[BaseModel]) -> dict[str, Any]:
    """Remove constraints unsupported by Anthropic's structured-output schema subset."""
    schema = response_model.model_json_schema()

    def sanitize(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: sanitize(item)
                for key, item in value.items()
                if key not in {"minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"}
            }
        if isinstance(value, list):
            return [sanitize(item) for item in value]
        return value

    return sanitize(schema)
