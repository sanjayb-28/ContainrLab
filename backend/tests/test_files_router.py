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
from backend.app.services.auth_service import hash_token
from backend.app.services.runner_client import RunnerClient, get_runner_client
from backend.app.services.storage import Storage, get_storage


def _prepare_storage(tmp_path: Path, session_id: str) -> tuple[Storage, dict[str, str]]:
    storage = Storage(db_path=tmp_path / "fs.db")
    storage.init()
    token = "fs-token"
    user = storage.upsert_user_token("fs@example.com", hash_token(token))
    storage.record_session(
        session_id=session_id,
        lab_slug="lab1",
        runner_container="container",
        ttl_seconds=2700,
        user_id=user["user_id"],
    )
    headers = {"Authorization": f"Bearer {token}"}
    return storage, headers


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


def test_list_path_override(tmp_path: Path):
    storage, headers = _prepare_storage(tmp_path, "test-session")
    app.dependency_overrides[get_runner_client] = override_runner_client
    app.dependency_overrides[get_storage] = lambda: storage
    response = client.get("/fs/test-session/list", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["entries"][0]["name"] == "Dockerfile"
    assert payload["exists"] is True
    assert payload["is_dir"] is True
    app.dependency_overrides.clear()


def test_write_invalid_encoding(tmp_path: Path):
    storage, headers = _prepare_storage(tmp_path, "abc")
    app.dependency_overrides[get_runner_client] = override_runner_client
    app.dependency_overrides[get_storage] = lambda: storage
    response = client.post(
        "/fs/write",
        json={"session_id": "abc", "path": "/workspace/test.txt", "content": "abc", "encoding": "utf-8"},
        headers=headers,
    )
    assert response.status_code == 400
    app.dependency_overrides.clear()


def test_create_file_request(tmp_path: Path):
    storage, headers = _prepare_storage(tmp_path, "abc")
    fake = FakeRunner()
    app.dependency_overrides[get_runner_client] = lambda: fake
    app.dependency_overrides[get_storage] = lambda: storage
    response = client.post(
        "/fs/create",
        json={
            "session_id": "abc",
            "path": "/workspace/new.txt",
            "kind": "file",
            "content": base64.b64encode(b"data").decode("ascii"),
        },
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["path"] == "/workspace/new.txt"
    assert fake.created == [("/workspace/new.txt", "file")]
    app.dependency_overrides.clear()


def test_create_directory_request(tmp_path: Path):
    storage, headers = _prepare_storage(tmp_path, "abc")
    fake = FakeRunner()
    app.dependency_overrides[get_runner_client] = lambda: fake
    app.dependency_overrides[get_storage] = lambda: storage
    response = client.post(
        "/fs/create",
        json={"session_id": "abc", "path": "/workspace/new", "kind": "directory"},
        headers=headers,
    )
    assert response.status_code == 200
    assert fake.created == [("/workspace/new", "directory")]
    app.dependency_overrides.clear()


def test_rename_request(tmp_path: Path):
    storage, headers = _prepare_storage(tmp_path, "abc")
    fake = FakeRunner()
    app.dependency_overrides[get_runner_client] = lambda: fake
    app.dependency_overrides[get_storage] = lambda: storage
    response = client.post(
        "/fs/rename",
        json={"session_id": "abc", "path": "/workspace/old.txt", "new_path": "/workspace/new.txt"},
        headers=headers,
    )
    assert response.status_code == 200
    assert fake.renamed == [("/workspace/old.txt", "/workspace/new.txt")]
    app.dependency_overrides.clear()


def test_delete_request(tmp_path: Path):
    storage, headers = _prepare_storage(tmp_path, "abc")
    fake = FakeRunner()
    app.dependency_overrides[get_runner_client] = lambda: fake
    app.dependency_overrides[get_storage] = lambda: storage
    response = client.post(
        "/fs/delete",
        json={"session_id": "abc", "path": "/workspace/delete.txt"},
        headers=headers,
    )
    assert response.status_code == 200
    assert fake.deleted == ["/workspace/delete.txt"]
    app.dependency_overrides.clear()
