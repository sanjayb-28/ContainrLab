from __future__ import annotations

import json
import os
import sqlite3
import threading
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

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
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            token_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_login_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            lab_slug TEXT NOT NULL,
            runner_container TEXT NOT NULL,
            ttl_seconds INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            ended_at TEXT,
            user_id TEXT,
            FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE SET NULL
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
                self._ensure_column("users", "token_hash", "ALTER TABLE users ADD COLUMN token_hash TEXT")
                self._ensure_column("users", "last_login_at", "ALTER TABLE users ADD COLUMN last_login_at TEXT")
                self._ensure_column("sessions", "user_id", "ALTER TABLE sessions ADD COLUMN user_id TEXT")
                self._ensure_column("sessions", "expires_at", "ALTER TABLE sessions ADD COLUMN expires_at TEXT")
                self._ensure_column("sessions", "ended_at", "ALTER TABLE sessions ADD COLUMN ended_at TEXT")
                self._connection.execute(
                    """
                    UPDATE users
                    SET token_hash = COALESCE(token_hash, '')
                    """
                )
                self._connection.execute(
                    """
                    UPDATE users
                    SET last_login_at = COALESCE(last_login_at, created_at)
                    """
                )
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
        user_id: str,
    ) -> dict[str, str]:
        created_at = _utc_now()
        expires_at = (datetime.fromisoformat(created_at) + timedelta(seconds=ttl_seconds)).isoformat()
        try:
            with self._lock:
                self._connection.execute(
                    """
                    INSERT OR REPLACE INTO sessions (session_id, lab_slug, runner_container, ttl_seconds, created_at, expires_at, ended_at, user_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (session_id, lab_slug, runner_container, ttl_seconds, created_at, expires_at, None, user_id),
                )
                self._connection.commit()
        except sqlite3.Error as exc:
            raise StorageError(f"Failed to persist session '{session_id}': {exc}") from exc
        return {"created_at": created_at, "expires_at": expires_at}

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

    def upsert_user_token(self, email: str, token_hash: str) -> Dict[str, Any]:
        now = _utc_now()
        try:
            with self._lock:
                cursor = self._connection.execute(
                    "SELECT user_id, created_at FROM users WHERE email = ?",
                    (email.lower(),),
                )
                row = cursor.fetchone()
                if row:
                    user_id = row["user_id"]
                    created_at = row["created_at"]
                    self._connection.execute(
                        """
                        UPDATE users
                        SET token_hash = ?, last_login_at = ?
                        WHERE user_id = ?
                        """,
                        (token_hash, now, user_id),
                    )
                else:
                    user_id = uuid4().hex
                    created_at = now
                    self._connection.execute(
                        """
                        INSERT INTO users (user_id, email, token_hash, created_at, last_login_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (user_id, email.lower(), token_hash, created_at, now),
                    )
                self._connection.commit()
        except sqlite3.Error as exc:
            raise StorageError(f"Failed to persist user for '{email}': {exc}") from exc
        return {
            "user_id": user_id,
            "email": email.lower(),
            "created_at": created_at,
            "last_login_at": now,
        }

    def get_user_by_token_hash(self, token_hash: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            cursor = self._connection.execute(
                """
                SELECT user_id, email, created_at, last_login_at
                FROM users
                WHERE token_hash = ?
                """,
                (token_hash,),
            )
            row = cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            cursor = self._connection.execute(
                """
                SELECT user_id, email, created_at, last_login_at
                FROM users
                WHERE user_id = ?
                """,
                (user_id,),
            )
            row = cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            cursor = self._connection.execute(
                """
                SELECT session_id, lab_slug, runner_container, ttl_seconds, created_at, expires_at, ended_at, user_id
                FROM sessions
                WHERE session_id = ?
                """,
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

    def assert_session_owner(self, session_id: str, user_id: str) -> Dict[str, Any]:
        session = self.get_session(session_id)
        if session is None:
            raise StorageError(f"Session '{session_id}' not found")
        owner = session.get("user_id")
        if owner is None:
            raise StorageError(f"Session '{session_id}' is not associated with a user yet")
        if owner != user_id:
            raise StorageError(f"Session '{session_id}' does not belong to the authenticated user")
        return session

    def list_expired_sessions(self, before: datetime | None = None) -> List[Dict[str, Any]]:
        cutoff = (before or datetime.now(timezone.utc)).isoformat()
        with self._lock:
            cursor = self._connection.execute(
                """
                SELECT session_id, lab_slug, runner_container, ttl_seconds, created_at, expires_at, user_id
                FROM sessions
                WHERE ended_at IS NULL
                AND expires_at IS NOT NULL
                AND expires_at <= ?
                """,
                (cutoff,),
            )
            rows = cursor.fetchall()
        return [dict(row) for row in rows]

    def mark_session_ended(self, session_id: str, *, ended_at: str | None = None) -> bool:
        ended_value = ended_at or _utc_now()
        try:
            with self._lock:
                cursor = self._connection.execute(
                    "UPDATE sessions SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL",
                    (ended_value, session_id),
                )
                self._connection.commit()
        except sqlite3.Error as exc:
            raise StorageError(f"Failed to mark session '{session_id}' as ended: {exc}") from exc
        return cursor.rowcount > 0

    def _ensure_column(self, table: str, column: str, statement: str) -> None:
        """Add a column to an existing table if it is missing."""
        cursor = self._connection.execute(f"PRAGMA table_info({table})")
        existing = {row[1] for row in cursor.fetchall()}
        if column in existing:
            return
        self._connection.execute(statement)


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
