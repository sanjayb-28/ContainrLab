from __future__ import annotations

import base64
from typing import Any, Dict

import sys
from pathlib import Path

from fastapi.testclient import TestClient  # type: ignore[import]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.main import app
from backend.app.services.runner_client import RunnerClient, get_runner_client


class FakeRunner(RunnerClient):
    def __init__(self) -> None:  # pragma: no cover - override base init
        pass

    async def list_path(self, session_id: str, path: str | None = None) -> dict[str, Any]:
        return {
            "entries": [
                {"name": "Dockerfile", "path": "/workspace/Dockerfile", "is_dir": False, "size": 42, "modified": 1.0}
            ],
        }

    async def read_file(self, session_id: str, path: str) -> dict[str, Any]:
        return {
            "path": path,
            "encoding": "base64",
            "content": base64.b64encode(b"hello").decode("ascii"),
        }

    async def write_file(self, session_id: str, *, path: str, content_b64: str) -> dict[str, Any]:
        return {"ok": True, "path": path}


client = TestClient(app)


def override_runner_client() -> FakeRunner:
    return FakeRunner()


def test_list_path_override():
    app.dependency_overrides[get_runner_client] = override_runner_client
    response = client.get("/fs/test-session/list")
    assert response.status_code == 200
    payload = response.json()
    assert payload["entries"][0]["name"] == "Dockerfile"
    app.dependency_overrides.clear()


def test_write_invalid_encoding():
    app.dependency_overrides[get_runner_client] = override_runner_client
    response = client.post(
        "/fs/write",
        json={"session_id": "abc", "path": "/workspace/test.txt", "content": "abc", "encoding": "utf-8"},
    )
    assert response.status_code == 400
    app.dependency_overrides.clear()
