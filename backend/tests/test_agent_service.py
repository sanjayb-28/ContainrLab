from __future__ import annotations

import asyncio
from typing import Any, Dict

import sys
from pathlib import Path

import httpx  # type: ignore[import]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.services.agent_service import (  # noqa: E402
    AgentRateLimitError,
    AgentResult,
    AgentService,
    RateLimiter,
)


def _make_client(response_json: Dict[str, Any]) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:  # type: ignore[name-defined]
        return httpx.Response(200, json=response_json)

    transport = httpx.MockTransport(handler)  # type: ignore[attr-defined]
    return httpx.AsyncClient(transport=transport, timeout=5.0)


def test_service_returns_fallback_when_disabled() -> None:
    service = AgentService(api_key=None)
    result = asyncio.run(service.generate_hint("sess", "Hello"))
    assert result.answer
    # When API key is None, service logs error and returns fallback, not stub
    assert result.source == "fallback"


def test_service_successful_response() -> None:
    payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "Here is a tailored hint."},
                    ]
                }
            }
        ]
    }
    service = AgentService(
        api_key="test-key",
        client_factory=lambda: _make_client(payload),
    )
    result = asyncio.run(service.generate_hint("sess", "Hi", lab_slug="lab1"))
    assert isinstance(result, AgentResult)
    assert result.source == "gemini"
    assert "hint" in result.answer.lower()


def test_service_rate_limit_blocks_requests() -> None:
    limiter = RateLimiter(max_calls=1, period_seconds=60)
    payload = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "First answer"}],
                }
            }
        ]
    }
    service = AgentService(
        api_key="test-key",
        client_factory=lambda: _make_client(payload),
        rate_limiter=limiter,
    )

    async def _exercise() -> None:
        await service.generate_hint("sess", "Hi")
        try:
            await service.generate_hint("sess", "Another")
        except AgentRateLimitError:
            return
        raise AssertionError("Expected AgentRateLimitError to be raised")

    asyncio.run(_exercise())
