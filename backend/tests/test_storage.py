from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest  # type: ignore[import]

from judge.models import JudgeFailure, JudgeResult

from backend.app.services.storage import Storage


def test_storage_records_session_and_attempt(tmp_path: Path) -> None:
    db_path = tmp_path / "app.db"
    storage = Storage(db_path=db_path)
    storage.init()

    user = storage.upsert_user_token("tester@example.com", "hash")

    session_id = "abc123"
    storage.record_session(
        session_id=session_id,
        lab_slug="lab1",
        runner_container="rl_sess_abc123",
        ttl_seconds=2700,
        user_id=user["user_id"],
    )

    session = storage.get_session(session_id)
    assert session is not None
    assert session["lab_slug"] == "lab1"
    assert session["runner_container"] == "rl_sess_abc123"
    assert "expires_at" in session
    assert session.get("ended_at") is None

    result = JudgeResult(
        passed=False,
        failures=[JudgeFailure(code="fail", message="missing file")],
        metrics={"image_size_mb": 42.1},
        notes={"hints": ["add a Dockerfile"]},
    )
    storage.record_attempt(session_id=session_id, lab_slug="lab1", result=result)

    attempts = storage.list_attempts(session_id)
    assert len(attempts) == 1
    saved = attempts[0]
    assert saved["passed"] is False
    assert saved["metrics"]["image_size_mb"] == 42.1
    assert saved["failures"][0]["code"] == "fail"

    marked = storage.mark_session_ended(session_id=session_id)
    assert marked is True
    marked_again = storage.mark_session_ended(session_id=session_id)
    assert marked_again is False


def test_list_attempts_limit_returns_latest_first(tmp_path: Path) -> None:
    storage = Storage(db_path=tmp_path / "limit.db")
    storage.init()
    user = storage.upsert_user_token("limit@example.com", "hash")

    storage.record_session(
        session_id="abc",
        lab_slug="lab1",
        runner_container="container",
        ttl_seconds=123,
        user_id=user["user_id"],
    )

    for idx in range(3):
        storage.record_attempt(
            session_id="abc",
            lab_slug="lab1",
            result=JudgeResult(passed=bool(idx % 2), failures=[], metrics={"idx": idx}, notes={}),
        )

    attempts = storage.list_attempts("abc", limit=2)
    assert len(attempts) == 2
    assert attempts[0]["metrics"]["idx"] == 2
    assert attempts[1]["metrics"]["idx"] == 1


def test_storage_get_session_missing(tmp_path: Path) -> None:
    storage = Storage(db_path=tmp_path / "other.db")
    storage.init()
    assert storage.get_session("missing") is None


def test_record_attempt_requires_existing_session(tmp_path: Path) -> None:
    storage = Storage(db_path=tmp_path / "backfill.db")
    storage.init()

    session_id = "ghost"
    result = JudgeResult(passed=True, failures=[], metrics={}, notes={})

    with pytest.raises(Exception) as excinfo:
        storage.record_attempt(session_id=session_id, lab_slug="lab-z", result=result)
    assert "not found" in str(excinfo.value)


def test_list_expired_sessions(tmp_path: Path) -> None:
    storage = Storage(db_path=tmp_path / "exp.db")
    storage.init()

    user = storage.upsert_user_token("expired@example.com", "hash")

    storage.record_session(
        session_id="expired",
        lab_slug="lab1",
        runner_container="container",
        ttl_seconds=5,
        user_id=user["user_id"],
    )
    storage.record_session(
        session_id="active",
        lab_slug="lab2",
        runner_container="container2",
        ttl_seconds=9999,
        user_id=user["user_id"],
    )

    cutoff = datetime.now(timezone.utc) + timedelta(seconds=10)
    expired = storage.list_expired_sessions(before=cutoff)
    assert any(entry["session_id"] == "expired" for entry in expired)
    assert not any(entry["session_id"] == "active" for entry in expired)


def test_get_active_sessions_filters_expired(tmp_path: Path) -> None:
    storage = Storage(db_path=tmp_path / "active.db")
    storage.init()
    user = storage.upsert_user_token("active@example.com", "hash")

    record = storage.record_session(
        session_id="sess1",
        lab_slug="lab1",
        runner_container="runner-1",
        ttl_seconds=60,
        user_id=user["user_id"],
    )
    assert "expires_at" in record

    storage.record_session(
        session_id="sess2",
        lab_slug="lab1",
        runner_container="runner-2",
        ttl_seconds=60,
        user_id=user["user_id"],
    )

    # Force the first session to expire
    expired_at = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
    with storage._lock:  # type: ignore[attr-defined]
        storage._connection.execute(  # type: ignore[attr-defined]
            "UPDATE sessions SET expires_at = ? WHERE session_id = ?",
            (expired_at, "sess1"),
        )
        storage._connection.commit()  # type: ignore[attr-defined]

    active_sessions = storage.get_active_sessions_for_lab(user["user_id"], "lab1")
    assert len(active_sessions) == 1
    assert active_sessions[0]["session_id"] == "sess2"
    expired_session = storage.get_session("sess1")
    assert expired_session is not None
    assert expired_session.get("ended_at") is not None
