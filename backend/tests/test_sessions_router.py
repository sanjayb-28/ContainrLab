from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient  # type: ignore[import]

from backend.app.main import app
from backend.app.services.storage import Storage, get_storage
from judge.models import JudgeFailure, JudgeResult


def _prepare_storage(tmp_path: Path) -> Storage:
    storage = Storage(db_path=tmp_path / "api.db")
    storage.init()
    return storage


def test_get_session_detail_returns_attempts(tmp_path: Path) -> None:
    storage = _prepare_storage(tmp_path)
    app.dependency_overrides[get_storage] = lambda: storage

    session_id = "abc123"
    storage.record_session(
        session_id=session_id,
        lab_slug="lab1",
        runner_container="container",
        ttl_seconds=2700,
    )

    for idx in range(2):
        storage.record_attempt(
            session_id=session_id,
            lab_slug="lab1",
            result=JudgeResult(passed=bool(idx), failures=[], metrics={"idx": idx}, notes={}),
        )

    client = TestClient(app)
    response = client.get(f"/sessions/{session_id}?limit=1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == session_id
    assert payload["lab_slug"] == "lab1"
    assert len(payload["attempts"]) == 1
    assert payload["attempts"][0]["metrics"]["idx"] == 1

    app.dependency_overrides.clear()


def test_get_session_detail_missing(tmp_path: Path) -> None:
    storage = _prepare_storage(tmp_path)
    app.dependency_overrides[get_storage] = lambda: storage

    client = TestClient(app)
    response = client.get("/sessions/missing")
    assert response.status_code == 404

    app.dependency_overrides.clear()


def test_inspector_endpoint(tmp_path: Path) -> None:
    storage = _prepare_storage(tmp_path)
    app.dependency_overrides[get_storage] = lambda: storage

    session_id = "inspect-1"
    storage.record_session(
        session_id=session_id,
        lab_slug="lab1",
        runner_container="container",
        ttl_seconds=2700,
    )
    storage.record_attempt(
        session_id=session_id,
        lab_slug="lab1",
        result=JudgeResult(
            passed=False,
            failures=[JudgeFailure(code="fail", message="oops")],
            metrics={"image_size_mb": 42.1},
            notes={},
        ),
    )

    client = TestClient(app)
    response = client.get(f"/sessions/{session_id}/inspector")
    assert response.status_code == 200
    payload = response.json()
    assert payload["attempt_count"] == 1
    assert payload["metrics"]["image_size_mb"] == 42.1
    assert payload["last_passed"] is False

    app.dependency_overrides.clear()
