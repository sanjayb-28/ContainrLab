from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient  # type: ignore[import]

from backend.app.main import app
from backend.app.services.auth_service import hash_token
from backend.app.services.storage import Storage, get_storage
from judge.models import JudgeFailure, JudgeResult


def _prepare_storage(tmp_path: Path) -> Storage:
    storage = Storage(db_path=tmp_path / "api.db")
    storage.init()
    return storage


def _auth_headers(storage: Storage, token: str = "test-token", email: str = "user@example.com") -> tuple[dict[str, str], dict[str, str]]:
    user = storage.upsert_user_token(email, hash_token(token))
    headers = {"Authorization": f"Bearer {token}"}
    return headers, user


def test_get_session_detail_returns_attempts(tmp_path: Path) -> None:
    storage = _prepare_storage(tmp_path)
    app.dependency_overrides[get_storage] = lambda: storage

    headers, user = _auth_headers(storage)

    session_id = "abc123"
    storage.record_session(
        session_id=session_id,
        lab_slug="lab1",
        runner_container="container",
        ttl_seconds=2700,
        user_id=user["user_id"],
    )

    for idx in range(2):
        storage.record_attempt(
            session_id=session_id,
            lab_slug="lab1",
            result=JudgeResult(passed=bool(idx), failures=[], metrics={"idx": idx}, notes={}),
        )

    client = TestClient(app)
    response = client.get(f"/sessions/{session_id}?limit=1", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == session_id
    assert payload["lab_slug"] == "lab1"
    assert "expires_at" in payload
    assert payload["ended_at"] is None
    assert len(payload["attempts"]) == 1
    assert payload["attempts"][0]["metrics"]["idx"] == 1

    app.dependency_overrides.clear()


def test_get_session_detail_missing(tmp_path: Path) -> None:
    storage = _prepare_storage(tmp_path)
    app.dependency_overrides[get_storage] = lambda: storage

    headers, _ = _auth_headers(storage)

    client = TestClient(app)
    response = client.get("/sessions/missing", headers=headers)
    assert response.status_code == 404

    app.dependency_overrides.clear()


def test_inspector_endpoint(tmp_path: Path) -> None:
    storage = _prepare_storage(tmp_path)
    app.dependency_overrides[get_storage] = lambda: storage

    headers, user = _auth_headers(storage, token="inspect-token", email="inspect@example.com")

    session_id = "inspect-1"
    storage.record_session(
        session_id=session_id,
        lab_slug="lab1",
        runner_container="container",
        ttl_seconds=2700,
        user_id=user["user_id"],
    )
    storage.record_attempt(
        session_id=session_id,
        lab_slug="lab1",
        result=JudgeResult(
            passed=False,
            failures=[JudgeFailure(code="fail", message="oops")],
            metrics={"build": {"image_size_mb": 48.0, "elapsed_seconds": 32.5}},
            notes={},
        ),
    )
    storage.record_attempt(
        session_id=session_id,
        lab_slug="lab1",
        result=JudgeResult(
            passed=False,
            failures=[JudgeFailure(code="fail", message="oops")],
            metrics={"build": {"image_size_mb": 42.1, "elapsed_seconds": 28.0, "cache_hits": 3}},
            notes={},
        ),
    )

    client = TestClient(app)
    response = client.get(f"/sessions/{session_id}/inspector", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["attempt_count"] == 2
    assert payload["metrics"]["build"]["image_size_mb"] == 42.1
    assert payload["previous_metrics"]["build"]["image_size_mb"] == 48.0
    assert payload["metric_deltas"]["build.image_size_mb"] == -5.9
    assert payload["last_passed"] is False
    assert len(payload["timeline"]) == 2
    assert payload["timeline"][0]["metrics"]["image_size_mb"] == 42.1
    assert payload["timeline"][0]["deltas"]["image_size_mb"] == -5.9

    app.dependency_overrides.clear()
