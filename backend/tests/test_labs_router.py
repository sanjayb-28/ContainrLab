from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient  # type: ignore[import]

from backend.app.main import app
from backend.app.services.auth_service import hash_token
from backend.app.services.storage import Storage, get_storage
from backend.app.services.runner_client import get_runner_client


class StubRunner:
    def __init__(self) -> None:
        self.started: list[tuple[str, str]] = []
        self.stopped: list[str] = []

    async def start(self, session_id: str, lab_slug: str) -> dict[str, str]:
        self.started.append((session_id, lab_slug))
        return {"container": f"runner-{session_id}"}

    async def stop(self, session_id: str, preserve_workspace: bool = False) -> dict[str, bool]:
        self.stopped.append(session_id)
        return {"stopped": True}


def _prepare_storage(tmp_path: Path) -> Storage:
    storage = Storage(db_path=tmp_path / "labs.db")
    storage.init()
    return storage


def test_start_lab_replaces_existing_session(tmp_path: Path) -> None:
    storage = _prepare_storage(tmp_path)
    runner = StubRunner()
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_runner_client] = lambda: runner

    token = "replace-token"
    user = storage.upsert_user_token("replace@example.com", hash_token(token))
    headers = {"Authorization": f"Bearer {token}"}

    client = TestClient(app)

    first_response = client.post("/labs/lab1/start", headers=headers)
    assert first_response.status_code == 200
    first_session_id = first_response.json()["session_id"]
    assert runner.started[0][0] == first_session_id

    second_response = client.post("/labs/lab1/start", headers=headers)
    assert second_response.status_code == 200
    second_payload = second_response.json()
    assert first_session_id in second_payload["replaced_session_ids"]
    assert runner.stopped == [first_session_id]

    first_session = storage.get_session(first_session_id)
    assert first_session is not None
    assert first_session.get("ended_at") is not None

    active_sessions = storage.get_active_sessions_for_lab(user["user_id"], "lab1")
    assert len(active_sessions) == 1
    assert active_sessions[0]["session_id"] == second_payload["session_id"]

    app.dependency_overrides.clear()


def test_get_active_session_endpoint(tmp_path: Path) -> None:
    storage = _prepare_storage(tmp_path)
    runner = StubRunner()
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_runner_client] = lambda: runner

    token = "active-token"
    storage.upsert_user_token("active@example.com", hash_token(token))
    headers = {"Authorization": f"Bearer {token}"}

    client = TestClient(app)

    empty_response = client.get("/labs/lab1/session", headers=headers)
    assert empty_response.status_code == 404

    start_response = client.post("/labs/lab1/start", headers=headers)
    assert start_response.status_code == 200
    session_id = start_response.json()["session_id"]

    active_response = client.get("/labs/lab1/session", headers=headers)
    assert active_response.status_code == 200
    payload = active_response.json()
    assert payload["session_id"] == session_id
    assert payload["ttl"] == start_response.json()["ttl"]

    app.dependency_overrides.clear()
