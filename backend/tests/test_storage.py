from __future__ import annotations

from pathlib import Path

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


def test_storage_get_session_missing(tmp_path: Path) -> None:
    storage = Storage(db_path=tmp_path / "other.db")
    storage.init()
    assert storage.get_session("missing") is None


def test_record_attempt_backfills_session(tmp_path: Path) -> None:
    storage = Storage(db_path=tmp_path / "backfill.db")
    storage.init()

    session_id = "ghost"
    result = JudgeResult(passed=True, failures=[], metrics={}, notes={})
    storage.record_attempt(session_id=session_id, lab_slug="lab-z", result=result)

    session = storage.get_session(session_id)
    assert session is not None
    assert session["runner_container"] == "unknown"
    assert session["ttl_seconds"] == 0
