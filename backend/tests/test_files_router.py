from __future__ import annotations

import base64
from typing import Any, List, Tuple

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
        self.created: List[Tuple[str, str]] = []
        self.renamed: List[Tuple[str, str]] = []
        self.deleted: List[str] = []

    async def list_path(self, session_id: str, path: str | None = None) -> dict[str, Any]:
        return {
            "path": path or "/workspace",
            "entries": [
                {"name": "Dockerfile", "path": "/workspace/Dockerfile", "is_dir": False, "size": 42, "modified": 1.0}
            ],
            "exists": True,
            "is_dir": True,
        }

    async def read_file(self, session_id: str, path: str) -> dict[str, Any]:
        return {
            "path": path,
            "encoding": "base64",
            "content": base64.b64encode(b"hello").decode("ascii"),
        }

    async def write_file(self, session_id: str, *, path: str, content_b64: str) -> dict[str, Any]:
        return {"ok": True, "path": path}

    async def create_entry(
        self,
        session_id: str,
        *,
        path: str,
        kind: str = "file",
        content_b64: str | None = None,
    ) -> dict[str, Any]:
        self.created.append((path, kind))
        return {"ok": True, "path": path, "kind": kind}

    async def rename_entry(self, session_id: str, *, path: str, new_path: str) -> dict[str, Any]:
        self.renamed.append((path, new_path))
        return {"ok": True, "path": path, "new_path": new_path}

    async def delete_entry(self, session_id: str, *, path: str) -> dict[str, Any]:
        self.deleted.append(path)
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
    assert payload["exists"] is True
    assert payload["is_dir"] is True
    app.dependency_overrides.clear()


def test_write_invalid_encoding():
    app.dependency_overrides[get_runner_client] = override_runner_client
    response = client.post(
        "/fs/write",
        json={"session_id": "abc", "path": "/workspace/test.txt", "content": "abc", "encoding": "utf-8"},
    )
    assert response.status_code == 400
    app.dependency_overrides.clear()


def test_create_file_request():
    fake = FakeRunner()
    app.dependency_overrides[get_runner_client] = lambda: fake
    response = client.post(
        "/fs/create",
        json={
            "session_id": "abc",
            "path": "/workspace/new.txt",
            "kind": "file",
            "content": base64.b64encode(b"data").decode("ascii"),
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["path"] == "/workspace/new.txt"
    assert fake.created == [("/workspace/new.txt", "file")]
    app.dependency_overrides.clear()


def test_create_directory_request():
    fake = FakeRunner()
    app.dependency_overrides[get_runner_client] = lambda: fake
    response = client.post(
        "/fs/create",
        json={"session_id": "abc", "path": "/workspace/new", "kind": "directory"},
    )
    assert response.status_code == 200
    assert fake.created == [("/workspace/new", "directory")]
    app.dependency_overrides.clear()


def test_rename_request():
    fake = FakeRunner()
    app.dependency_overrides[get_runner_client] = lambda: fake
    response = client.post(
        "/fs/rename",
        json={"session_id": "abc", "path": "/workspace/old.txt", "new_path": "/workspace/new.txt"},
    )
    assert response.status_code == 200
    assert fake.renamed == [("/workspace/old.txt", "/workspace/new.txt")]
    app.dependency_overrides.clear()


def test_delete_request():
    fake = FakeRunner()
    app.dependency_overrides[get_runner_client] = lambda: fake
    response = client.post(
        "/fs/delete",
        json={"session_id": "abc", "path": "/workspace/delete.txt"},
    )
    assert response.status_code == 200
    assert fake.deleted == ["/workspace/delete.txt"]
    app.dependency_overrides.clear()
