from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import defaultdict, deque
import json
from dataclasses import dataclass
from typing import Any, Callable, Deque, Dict, Optional
from string import Template

import httpx  # type: ignore[import]

logger = logging.getLogger("containrlab.agent")


def _log(level: int, message: str, metadata: Dict[str, Any], **extra: Any) -> None:
    payload = {**metadata, **extra}
    logger.log(level, message, extra=payload)

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-flash-latest")
DEFAULT_TEMPERATURE = float(os.getenv("GEMINI_TEMPERATURE", "0.7"))
DEFAULT_MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "2048"))
DEFAULT_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "20"))

FALLBACK_HINT = "Remember to install dependencies before building."
FALLBACK_EXPLANATION = (
    "Docker builds each instruction in order. Combine related commands to reduce layers and cache invalidations."
)
FALLBACK_PATCH = {
    "message": "Consider updating your Dockerfile to install dependencies before copying the application source. "
    "Below is an example you can adapt.",
    "files": [
        {
            "path": "/workspace/Dockerfile",
            "description": "Reorder COPY/RUN instructions for better caching.",
            "content": "# Example patch — adjust as needed\nFROM python:3.11-slim\n\nWORKDIR /app\n\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\n\nCOPY . .\n\nCMD [\"python\", \"app.py\"]\n",
        }
    ],
}

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

PATCH_TEMPLATE = Template(
    "You are ContainrLab's Docker assistant. The learner is working on lab '$lab_slug' and has asked for a patch.\n"
    "Review the prompt and return ONLY a JSON object (no Markdown, no prose outside JSON) with the following shape:\n\n"
    "{\n"
    '  "message": "<short summary of the changes>",\n'
    '  "files": [\n'
    "    {\n"
    '      "path": "/workspace/relative/path.ext",\n'
    '      "description": "Optional short note about this change",\n'
    '      "content": "The full desired file contents after applying the patch"\n'
    "    }\n"
    "  ]\n"
    "}\n\n"
    "Rules:\n"
    "- Output must be valid JSON that can be parsed directly.\n"
    "- Always include absolute paths rooted at /workspace.\n"
    "- Provide the full file content for each file listed.\n"
    "- If no concrete patch is appropriate, return an empty array for `files` and explain why in `message`.\n\n"
    "Learner prompt:\n$prompt"
)


class AgentServiceError(RuntimeError):
    """Raised when the Gemini service cannot fulfil a request."""


class AgentRateLimitError(AgentServiceError):
    """Raised when the caller exceeds the configured rate limit."""


@dataclass(slots=True)
class AgentResult:
    answer: str
    source: str


@dataclass(slots=True)
class PatchFileSpec:
    path: str
    content: str
    description: str | None = None


@dataclass(slots=True)
class AgentPatchResult:
    message: str
    files: list[PatchFileSpec]
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

    async def generate_patch(self, session_id: str, prompt: str, *, lab_slug: str | None = None) -> AgentPatchResult:
        cleaned_prompt = prompt.strip()
        if not cleaned_prompt:
            raise ValueError("Prompt cannot be empty")

        slug = lab_slug or "general"
        metadata = {
            "mode": "patch",
            "session_id": session_id,
            "lab_slug": slug,
            "prompt_chars": len(cleaned_prompt),
            "enabled": self._enabled,
        }

        if not self._enabled:
            _log(logging.INFO, "Gemini disabled; returning stub patch response", metadata, event="stub_fallback", source="stub")
            return self._fallback_patch()

        allowed = await self._rate_limiter.allow(session_id)
        if not allowed:
            _log(logging.INFO, "Gemini rate limit hit", metadata, event="rate_limit")
            raise AgentRateLimitError("Too many agent requests. Please try again shortly.")

        request_body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": PATCH_TEMPLATE.substitute(lab_slug=slug, prompt=cleaned_prompt)}],
                }
            ],
            "generationConfig": {
                "temperature": min(self._temperature, 0.5),
                "maxOutputTokens": min(self._max_output_tokens, 1024),
                "topP": 0.9,
            },
        }

        start_time = time.perf_counter()
        failure_reason: str | None = None

        try:
            _log(logging.INFO, "Gemini patch request dispatched", metadata, event="request_start")
            response_data = await self._invoke(request_body)
            answer = self._extract_text(response_data)
            if not answer:
                raise AgentServiceError("Gemini response did not include text content")

            patch = self._parse_patch_payload(answer)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            _log(
                logging.INFO,
                "Gemini patch response received",
                metadata,
                event="response",
                source="gemini",
                duration_ms=duration_ms,
                files=len(patch.files),
            )
            return AgentPatchResult(message=patch.message, files=patch.files, source="gemini")
        except (AgentServiceError, json.JSONDecodeError, KeyError, TypeError) as exc:
            failure_reason = str(exc)
            _log(logging.WARNING, "Gemini patch error", metadata, event="patch_error", error=failure_reason)
        except httpx.HTTPError as exc:
            failure_reason = str(exc)
            _log(logging.WARNING, "Gemini patch HTTP failure", metadata, event="patch_http_error", error=failure_reason)
        except Exception as exc:  # pragma: no cover - defensive
            failure_reason = str(exc)
            logger.exception("Unexpected Gemini patch failure", extra={**metadata, "event": "patch_unexpected"})

        _log(
            logging.INFO,
            "Using fallback patch response",
            metadata,
            event="patch_fallback",
            source="fallback",
            fallback_reason=failure_reason or "unknown",
        )
        return self._fallback_patch()

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

    @staticmethod
    def _clean_json_blob(raw: str) -> str:
        text = raw.strip()
        if text.startswith("```"):
            segments = text.split("```")
            for segment in segments:
                segment = segment.strip()
                if not segment:
                    continue
                if segment.startswith("json"):
                    segment = segment[len("json"):].strip()
                return segment
        return text

    def _parse_patch_payload(self, raw: str) -> AgentPatchResult:
        cleaned = self._clean_json_blob(raw)
        data = json.loads(cleaned)
        message = data.get("message") or "Patch suggestion"
        files_payload = data.get("files") or []
        if not isinstance(files_payload, list):
            raise AgentServiceError("Patch payload 'files' must be a list")
        files: list[PatchFileSpec] = []
        for entry in files_payload:
            if not isinstance(entry, dict):
                continue
            path = entry.get("path")
            content = entry.get("content")
            if not isinstance(path, str) or not isinstance(content, str):
                continue
            description = entry.get("description")
            if description is not None and not isinstance(description, str):
                description = str(description)
            files.append(PatchFileSpec(path=path, content=content, description=description))
        return AgentPatchResult(message=str(message), files=files, source="gemini")

    @staticmethod
    def _fallback_patch() -> AgentPatchResult:
        files = [
            PatchFileSpec(
                path=file["path"],
                content=file["content"],
                description=file.get("description"),
            )
            for file in FALLBACK_PATCH.get("files", [])
            if isinstance(file, dict) and isinstance(file.get("path"), str) and isinstance(file.get("content"), str)
        ]
        return AgentPatchResult(
            message=str(FALLBACK_PATCH.get("message", "Review the Dockerfile for best practices.")),
            files=files,
            source="fallback",
        )


def get_agent_service() -> AgentService:
    return AgentService.from_env()
