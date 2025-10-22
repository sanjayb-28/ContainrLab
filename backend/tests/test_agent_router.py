from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient  # type: ignore[import]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.main import app
from backend.app.services.agent_service import (
    AgentRateLimitError,
    AgentResult,
    get_agent_service,
)

client = TestClient(app)


class FakeAgent:
    def __init__(self) -> None:
        self.hint_calls: list[tuple[str, str]] = []
        self.explain_calls: list[tuple[str, str]] = []

    async def generate_hint(
        self,
        session_id: str,
        prompt: str,
        *,
        lab_slug: str | None = None,
    ) -> AgentResult:
        self.hint_calls.append((session_id, prompt))
        return AgentResult(answer="Hint from fake agent", source="gemini")

    async def generate_explanation(
        self,
        session_id: str,
        prompt: str,
        *,
        lab_slug: str | None = None,
    ) -> AgentResult:
        self.explain_calls.append((session_id, prompt))
        raise AgentRateLimitError("Too many agent requests. Please try again shortly.")


def override_agent_service() -> FakeAgent:
    return FakeAgent()


def test_hint_endpoint_returns_stub() -> None:
    fake = FakeAgent()
    app.dependency_overrides[get_agent_service] = lambda: fake
    response = client.post(
        "/agent/hint",
        json={"session_id": "abc", "prompt": "Need a hint", "lab_slug": "lab1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"] == "Hint from fake agent"
    assert payload["session_id"] == "abc"
    assert payload["source"] == "gemini"
    assert fake.hint_calls == [("abc", "Need a hint")]
    app.dependency_overrides.clear()


def test_explain_endpoint_rejects_empty_prompt() -> None:
    response = client.post(
        "/agent/explain",
        json={"session_id": "abc", "prompt": "   "},
    )
    assert response.status_code == 400


def test_explain_endpoint_returns_rate_limit_error() -> None:
    fake = FakeAgent()
    app.dependency_overrides[get_agent_service] = lambda: fake

    response = client.post(
        "/agent/explain",
        json={"session_id": "abc", "prompt": "Explain please"},
    )
    assert response.status_code == 429
    assert "Too many agent requests" in response.json()["detail"]
    assert fake.explain_calls == [("abc", "Explain please")]

    app.dependency_overrides.clear()
