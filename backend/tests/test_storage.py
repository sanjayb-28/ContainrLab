from __future__ import annotations

from pathlib import Path

import pytest  # type: ignore[import]

from judge.models import JudgeFailure, JudgeResult

from backend.app.services.storage import Storage


def test_storage_records_session_and_attempt(tmp_path: Path) -> None:
    db_path = tmp_path / "app.db"
    storage = Storage(db_path=db_path)
    storage.init()

    session_id = "abc123"
    storage.record_session(
        session_id=session_id,
        lab_slug="lab1",
        runner_container="rl_sess_abc123",
        ttl_seconds=2700,
    )

    session = storage.get_session(session_id)
    assert session is not None
    assert session["lab_slug"] == "lab1"
    assert session["runner_container"] == "rl_sess_abc123"

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


def test_list_attempts_limit_returns_latest_first(tmp_path: Path) -> None:
    storage = Storage(db_path=tmp_path / "limit.db")
    storage.init()
    storage.record_session(
        session_id="abc",
        lab_slug="lab1",
        runner_container="container",
        ttl_seconds=123,
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
