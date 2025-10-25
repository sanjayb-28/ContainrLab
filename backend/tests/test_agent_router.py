from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient  # type: ignore[import]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.main import app
from backend.app.services.agent_service import (
    AgentPatchResult,
    AgentRateLimitError,
    AgentResult,
    PatchFileSpec,
    get_agent_service,
)
from backend.app.services.auth_service import hash_token
from backend.app.services.storage import Storage, get_storage
from backend.app.services.runner_client import get_runner_client


def _prepare_storage(tmp_path: Path, session_id: str) -> dict[str, str]:
    storage = Storage(db_path=tmp_path / "agent.db")
    storage.init()
    token = "agent-token"
    user = storage.upsert_user_token("agent@example.com", hash_token(token))
    storage.record_session(
        session_id=session_id,
        lab_slug="lab1",
        runner_container="container",
        ttl_seconds=2700,
        user_id=user["user_id"],
    )
    app.dependency_overrides[get_storage] = lambda: storage
    return {"Authorization": f"Bearer {token}"}

client = TestClient(app)


class FakeAgent:
    def __init__(self) -> None:
        self.hint_calls: list[tuple[str, str]] = []
        self.explain_calls: list[tuple[str, str]] = []
        self.patch_calls: list[tuple[str, str]] = []

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

    async def generate_patch(
        self,
        session_id: str,
        prompt: str,
        *,
        lab_slug: str | None = None,
    ) -> AgentPatchResult:
        self.patch_calls.append((session_id, prompt))
        return AgentPatchResult(
            message="Update Dockerfile install order",
            files=[
                PatchFileSpec(
                    path="/workspace/Dockerfile",
                    description="Reorder COPY and RUN instructions",
                    content="FROM alpine:3.19\nCOPY . .\n",
                )
            ],
            source="gemini",
        )


def override_agent_service() -> FakeAgent:
    return FakeAgent()


def test_hint_endpoint_returns_stub(tmp_path: Path) -> None:
    fake = FakeAgent()
    app.dependency_overrides[get_agent_service] = lambda: fake
    headers = _prepare_storage(tmp_path, "abc")
    response = client.post(
        "/agent/hint",
        json={"session_id": "abc", "prompt": "Need a hint", "lab_slug": "lab1"},
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"] == "Hint from fake agent"
    assert payload["session_id"] == "abc"
    assert payload["source"] == "gemini"
    assert fake.hint_calls == [("abc", "Need a hint")]
    app.dependency_overrides.clear()


def test_explain_endpoint_rejects_empty_prompt(tmp_path: Path) -> None:
    headers = _prepare_storage(tmp_path, "abc")
    response = client.post(
        "/agent/explain",
        json={"session_id": "abc", "prompt": "   "},
        headers=headers,
    )
    assert response.status_code == 400


def test_explain_endpoint_returns_rate_limit_error(tmp_path: Path) -> None:
    fake = FakeAgent()
    app.dependency_overrides[get_agent_service] = lambda: fake
    headers = _prepare_storage(tmp_path, "abc")

    response = client.post(
        "/agent/explain",
        json={"session_id": "abc", "prompt": "Explain please"},
        headers=headers,
    )
    assert response.status_code == 429
    assert "Too many agent requests" in response.json()["detail"]
    assert fake.explain_calls == [("abc", "Explain please")]

    app.dependency_overrides.clear()


def test_patch_endpoint_returns_files(tmp_path: Path) -> None:
    fake = FakeAgent()
    app.dependency_overrides[get_agent_service] = lambda: fake
    headers = _prepare_storage(tmp_path, "session-patch")

    response = client.post(
        "/agent/patch",
        json={"session_id": "session-patch", "prompt": "Fix Dockerfile"},
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "Update Dockerfile install order"
    assert payload["files"][0]["path"] == "/workspace/Dockerfile"
    assert fake.patch_calls == [("session-patch", "Fix Dockerfile")]
    app.dependency_overrides.clear()


def test_patch_apply_writes_files(tmp_path: Path) -> None:
    headers = _prepare_storage(tmp_path, "apply-patch")

    class FakeRunner:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str, str]] = []

        async def write_file(self, *, session_id: str, path: str, content_b64: str) -> dict[str, object]:
            self.calls.append((session_id, path, content_b64))
            return {"ok": True, "path": path}

    fake_runner = FakeRunner()
    app.dependency_overrides[get_runner_client] = lambda: fake_runner

    response = client.post(
        "/agent/patch/apply",
        json={
            "session_id": "apply-patch",
            "files": [
                {
                    "path": "/workspace/Dockerfile",
                    "content": "FROM alpine:3.19\n",
                    "description": ""
                }
            ],
        },
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["applied"] == ["/workspace/Dockerfile"]
    assert len(fake_runner.calls) == 1
    session_id, path, content_b64 = fake_runner.calls[0]
    assert session_id == "apply-patch"
    assert path == "/workspace/Dockerfile"
    assert content_b64 != ""
    app.dependency_overrides.clear()
