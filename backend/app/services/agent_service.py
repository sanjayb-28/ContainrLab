from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any, Callable, Deque, Dict, Optional

import httpx  # type: ignore[import]

logger = logging.getLogger("containrlab.agent")


def _log(level: int, message: str, metadata: Dict[str, Any], **extra: Any) -> None:
    payload = {**metadata, **extra}
    logger.log(level, message, extra=payload)

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-1.5-flash")
DEFAULT_TEMPERATURE = float(os.getenv("GEMINI_TEMPERATURE", "0.7"))
DEFAULT_MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "512"))
DEFAULT_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "20"))

FALLBACK_HINT = "Remember to install dependencies before building."
FALLBACK_EXPLANATION = (
    "Docker builds each instruction in order. Combine related commands to reduce layers and cache invalidations."
)

HINT_TEMPLATE = (
    "You are ContainrLab's Docker tutor helping a learner who is working on the lab '{lab_slug}'. "
    "Provide a concise hint that nudges them toward the next step without revealing the full solution. "
    "Keep the tone encouraging, reference Docker best practices, and suggest one actionable idea.\n\n"
    "Learner request:\n{prompt}"
)

EXPLAIN_TEMPLATE = (
    "You are ContainrLab's Docker instructor. The learner has requested an explanation for lab '{lab_slug}'. "
    "Offer a clear, beginner-friendly explanation of the core concepts they should understand next. "
    "Summarise in a short paragraph (3-4 sentences) and highlight the most important takeaway.\n\n"
    "Learner request:\n{prompt}"
)


class AgentServiceError(RuntimeError):
    """Raised when the Gemini service cannot fulfil a request."""


class AgentRateLimitError(AgentServiceError):
    """Raised when the caller exceeds the configured rate limit."""


@dataclass(slots=True)
class AgentResult:
    answer: str
    source: str


class RateLimiter:
    """Simple in-memory token bucket with shared process scope."""

    def __init__(self, max_calls: int, period_seconds: float) -> None:
        self._max_calls = max_calls
        self._period = period_seconds
        self._events: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def allow(self, key: str) -> bool:
        async with self._lock:
            now = time.monotonic()
            window = self._events[key]
            while window and now - window[0] > self._period:
                window.popleft()
            if len(window) >= self._max_calls:
                return False
            window.append(now)
            return True


def _read_api_key() -> Optional[str]:
    file_path = os.getenv("GEMINI_API_KEY_FILE")
    if file_path:
        try:
            with open(file_path, "r", encoding="utf-8") as handle:
                key = handle.read().strip()
                if key:
                    return key
        except OSError as exc:  # pragma: no cover - file access errors are logged upstream
            logger.warning("Failed to read GEMINI_API_KEY_FILE '%s': %s", file_path, exc)
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key:
        return env_key.strip()
    return None


class AgentService:
    """Gemini-powered agent helper with safe prompts and graceful fallbacks."""

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        temperature: float = DEFAULT_TEMPERATURE,
        max_output_tokens: int = DEFAULT_MAX_OUTPUT_TOKENS,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        rate_limiter: RateLimiter | None = None,
        client_factory: Callable[[], httpx.AsyncClient] | None = None,
    ) -> None:
        self._api_key = api_key or _read_api_key()
        self._model = model
        self._temperature = temperature
        self._max_output_tokens = max_output_tokens
        self._timeout_seconds = timeout_seconds
        self._endpoint = f"https://generativelanguage.googleapis.com/v1beta/{self._model}:generateContent"
        self._rate_limiter = rate_limiter or RateLimiter(max_calls=5, period_seconds=60)
        self._client_factory = client_factory or self._default_client_factory
        self._enabled = bool(self._api_key)
        if not self._enabled:
            logger.warning("Gemini agent disabled: missing API key")

    @classmethod
    def from_env(cls) -> "AgentService":
        return cls()

    def _default_client_factory(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=self._timeout_seconds)

    async def generate_hint(self, session_id: str, prompt: str, *, lab_slug: str | None = None) -> AgentResult:
        return await self._generate(
            mode="hint",
            session_id=session_id,
            prompt=prompt,
            lab_slug=lab_slug,
            template=HINT_TEMPLATE,
            fallback=FALLBACK_HINT,
        )

    async def generate_explanation(self, session_id: str, prompt: str, *, lab_slug: str | None = None) -> AgentResult:
        return await self._generate(
            mode="explain",
            session_id=session_id,
            prompt=prompt,
            lab_slug=lab_slug,
            template=EXPLAIN_TEMPLATE,
            fallback=FALLBACK_EXPLANATION,
        )

    async def _generate(
        self,
        *,
        mode: str,
        session_id: str,
        prompt: str,
        lab_slug: str | None,
        template: str,
        fallback: str,
    ) -> AgentResult:
        cleaned_prompt = prompt.strip()
        slug = lab_slug or "general"
        metadata = {
            "mode": mode,
            "session_id": session_id,
            "lab_slug": slug,
            "prompt_chars": len(cleaned_prompt),
            "enabled": self._enabled,
        }

        if not cleaned_prompt:
            raise ValueError("Prompt cannot be empty")

        if not self._enabled:
            _log(logging.INFO, "Gemini disabled; returning stub response", metadata, event="stub_fallback", source="stub")
            return AgentResult(answer=fallback, source="stub")

        allowed = await self._rate_limiter.allow(session_id)
        if not allowed:
            _log(logging.INFO, "Gemini rate limit hit", metadata, event="rate_limit")
            raise AgentRateLimitError("Too many agent requests. Please try again shortly.")

        request_body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": template.format(lab_slug=slug, prompt=cleaned_prompt)}],
                }
            ],
            "generationConfig": {
                "temperature": self._temperature,
                "maxOutputTokens": self._max_output_tokens,
                "topP": 0.95,
            },
        }

        start_time = time.perf_counter()
        failure_reason: str | None = None

        try:
            _log(logging.INFO, "Gemini request dispatched", metadata, event="request_start")
            response_data = await self._invoke(request_body)
            answer = self._extract_text(response_data)
            if not answer:
                raise AgentServiceError("Gemini response did not include text content")
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            _log(
                logging.INFO,
                "Gemini response received",
                metadata,
                event="response",
                source="gemini",
                duration_ms=duration_ms,
                response_chars=len(answer),
            )
            return AgentResult(answer=answer, source="gemini")
        except AgentServiceError as exc:
            failure_reason = str(exc)
            _log(logging.WARNING, "Gemini service error", metadata, event="service_error", error=str(exc))
        except httpx.HTTPError as exc:
            failure_reason = str(exc)
            _log(logging.WARNING, "Gemini request failed", metadata, event="http_error", error=str(exc))
        except Exception as exc:  # pragma: no cover - safeguard against unexpected errors
            failure_reason = str(exc)
            logger.exception("Unexpected Gemini failure", extra={**metadata, "event": "unexpected_error"})

        _log(
            logging.INFO,
            "Using fallback response",
            metadata,
            event="fallback",
            source="fallback",
            fallback_reason=failure_reason or "unknown",
        )
        return AgentResult(answer=fallback, source="fallback")

    async def _invoke(self, payload: Dict[str, object]) -> Dict[str, object]:
        if not self._api_key:
            raise AgentServiceError("Cannot invoke Gemini without an API key")
        async with self._client_factory() as client:
            response = await client.post(
                self._endpoint,
                params={"key": self._api_key},
                json=payload,
            )
            if response.status_code == 429:
                raise AgentRateLimitError("Gemini API rate limit exceeded")
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise AgentServiceError(f"Gemini returned {exc.response.status_code}") from exc
            return response.json()

    @staticmethod
    def _extract_text(payload: Dict[str, object]) -> str | None:
        candidates = payload.get("candidates")
        if not isinstance(candidates, list):
            return None
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            content = candidate.get("content")
            if not isinstance(content, dict):
                continue
            parts = content.get("parts")
            if not isinstance(parts, list):
                continue
            for part in parts:
                if isinstance(part, dict):
                    text = part.get("text")
                    if isinstance(text, str) and text.strip():
                        return text.strip()
        return None


def get_agent_service() -> AgentService:
    return AgentService.from_env()
