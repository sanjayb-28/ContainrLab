from __future__ import annotations

import json
import os
import sqlite3
import threading
from dataclasses import asdict
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from judge.models import JudgeResult

DEFAULT_SQLITE_PATH = Path(
    os.getenv(
        "SQLITE_PATH",
        Path(__file__).resolve().parents[3] / "sqlite" / "app.db",
    )
).resolve()


class StorageError(RuntimeError):
    """Raised when persistence operations fail."""


class Storage:
    """Lightweight SQLite-backed persistence for sessions and judge attempts."""

    def __init__(self, db_path: Path | None = None) -> None:
        self._db_path = (db_path or DEFAULT_SQLITE_PATH).resolve()
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        try:
            self._connection = sqlite3.connect(
                self._db_path,
                detect_types=sqlite3.PARSE_DECLTYPES,
                check_same_thread=False,
            )
        except sqlite3.Error as exc:  # pragma: no cover - connection failure is fatal
            raise StorageError(f"Unable to open database at '{self._db_path}': {exc}") from exc
        self._connection.row_factory = sqlite3.Row
        with self._lock:
            self._connection.execute("PRAGMA foreign_keys = ON")
            self._connection.execute("PRAGMA journal_mode = WAL")

    @property
    def path(self) -> Path:
        return self._db_path

    def init(self) -> None:
        schema = """
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            lab_slug TEXT NOT NULL,
            runner_container TEXT NOT NULL,
            ttl_seconds INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            lab_slug TEXT NOT NULL,
            created_at TEXT NOT NULL,
            passed INTEGER NOT NULL,
            failures TEXT,
            metrics TEXT,
            notes TEXT,
            FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id);
        """
        try:
            with self._lock:
                self._connection.executescript(schema)
                self._connection.commit()
        except sqlite3.Error as exc:
            raise StorageError(f"Failed to initialise database schema: {exc}") from exc

    def record_session(
        self,
        *,
        session_id: str,
        lab_slug: str,
        runner_container: str,
        ttl_seconds: int,
    ) -> None:
        created_at = _utc_now()
        try:
            with self._lock:
                self._connection.execute(
                    """
                    INSERT OR REPLACE INTO sessions (session_id, lab_slug, runner_container, ttl_seconds, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (session_id, lab_slug, runner_container, ttl_seconds, created_at),
                )
                self._connection.commit()
        except sqlite3.Error as exc:
            raise StorageError(f"Failed to persist session '{session_id}': {exc}") from exc

    def record_attempt(
        self,
        *,
        session_id: str,
        lab_slug: str,
        result: JudgeResult,
    ) -> None:
        created_at = _utc_now()
        if self.get_session(session_id) is None:
            raise StorageError(
                f"Session '{session_id}' not found. Call /labs/{lab_slug}/start before judging."
            )
        failures_payload = json.dumps([asdict(failure) for failure in result.failures]) if result.failures else None
        metrics_payload = json.dumps(result.metrics, default=_json_default) if result.metrics else None
        notes_payload = json.dumps(result.notes, default=_json_default) if result.notes else None
        passed_value = 1 if result.passed else 0

        try:
            with self._lock:
                self._connection.execute(
                    """
                    INSERT INTO attempts (session_id, lab_slug, created_at, passed, failures, metrics, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (session_id, lab_slug, created_at, passed_value, failures_payload, metrics_payload, notes_payload),
                )
                self._connection.commit()
        except sqlite3.Error as exc:
            raise StorageError(f"Failed to persist attempt for session '{session_id}': {exc}") from exc

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            cursor = self._connection.execute(
                "SELECT session_id, lab_slug, runner_container, ttl_seconds, created_at FROM sessions WHERE session_id = ?",
                (session_id,),
            )
            row = cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    def list_attempts(self, session_id: str, *, limit: int | None = None) -> List[Dict[str, Any]]:
        with self._lock:
            query = """
                SELECT id, session_id, lab_slug, created_at, passed, failures, metrics, notes
                FROM attempts
                WHERE session_id = ?
                ORDER BY id DESC
            """
            params: tuple[Any, ...]
            if limit is not None:
                query += " LIMIT ?"
                params = (session_id, limit)
            else:
                params = (session_id,)
            cursor = self._connection.execute(query, params)
            rows = cursor.fetchall()
        attempts: List[Dict[str, Any]] = []
        for row in rows:
            attempts.append(
                {
                    "id": row["id"],
                    "session_id": row["session_id"],
                    "lab_slug": row["lab_slug"],
                    "created_at": row["created_at"],
                    "passed": bool(row["passed"]),
                    "failures": json.loads(row["failures"]) if row["failures"] else [],
                    "metrics": json.loads(row["metrics"]) if row["metrics"] else {},
                    "notes": json.loads(row["notes"]) if row["notes"] else {},
                }
            )
        return attempts

    def latest_attempt(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            cursor = self._connection.execute(
                """
                SELECT id, session_id, lab_slug, created_at, passed, failures, metrics, notes
                FROM attempts
                WHERE session_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (session_id,),
            )
            row = cursor.fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "session_id": row["session_id"],
            "lab_slug": row["lab_slug"],
            "created_at": row["created_at"],
            "passed": bool(row["passed"]),
            "failures": json.loads(row["failures"]) if row["failures"] else [],
            "metrics": json.loads(row["metrics"]) if row["metrics"] else {},
            "notes": json.loads(row["notes"]) if row["notes"] else {},
        }


@lru_cache
def get_storage() -> Storage:
    storage = Storage()
    storage.init()
    return storage


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_default(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    raise TypeError(f"Object of type {type(value)!r} is not JSON serializable")
