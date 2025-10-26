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
        self._user_columns: set[str] = set()
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
                self._ensure_column("users", "provider", "ALTER TABLE users ADD COLUMN provider TEXT")
                self._ensure_column(
                    "users",
                    "provider_account_id",
                    "ALTER TABLE users ADD COLUMN provider_account_id TEXT",
                )
                self._ensure_column("users", "name", "ALTER TABLE users ADD COLUMN name TEXT")
                self._ensure_column("users", "avatar_url", "ALTER TABLE users ADD COLUMN avatar_url TEXT")
                self._ensure_column("sessions", "user_id", "ALTER TABLE sessions ADD COLUMN user_id TEXT")
                self._ensure_column("sessions", "expires_at", "ALTER TABLE sessions ADD COLUMN expires_at TEXT")
                self._ensure_column("sessions", "ended_at", "ALTER TABLE sessions ADD COLUMN ended_at TEXT")
                if self._table_has_column("users", "updated_at"):
                    self._connection.execute(
                        """
                        UPDATE users
                        SET updated_at = COALESCE(updated_at, created_at)
                        """
                    )
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
                self._connection.execute(
                    """
                    UPDATE users
                    SET provider = COALESCE(provider, 'magic_link')
                    """
                )
                self._connection.execute(
                    """
                    UPDATE users
                    SET provider_account_id = COALESCE(provider_account_id, '')
                    """
                )
                self._connection.commit()
                self._user_columns = self._get_columns("users")
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

    def upsert_user_token(
        self,
        email: str,
        token_hash: str,
        *,
        provider: str | None = None,
        provider_account_id: str | None = None,
        name: str | None = None,
        avatar_url: str | None = None,
    ) -> Dict[str, Any]:
        normalized_email = email.strip().lower()
        now = _utc_now()
        provider_value = (provider or "magic_link").lower()
        if not self._user_columns:
            with self._lock:
                self._user_columns = self._get_columns("users")
        try:
            with self._lock:
                row = None
                if (
                    provider_value != "magic_link"
                    and provider_account_id
                    and "provider" in self._user_columns
                    and "provider_account_id" in self._user_columns
                ):
                    cursor = self._connection.execute(
                        "SELECT user_id, created_at FROM users WHERE provider = ? AND provider_account_id = ?",
                        (provider_value, provider_account_id),
                    )
                    row = cursor.fetchone()
                if row is None:
                    cursor = self._connection.execute(
                        "SELECT user_id, created_at FROM users WHERE email = ?",
                        (normalized_email,),
                    )
                    row = cursor.fetchone()
                if row:
                    user_id = row["user_id"]
                    created_at = row["created_at"]
                    update_fields = ["token_hash = ?", "last_login_at = ?", "email = ?"]
                    update_values: list[Any] = [token_hash, now, normalized_email]
                    if "provider" in self._user_columns:
                        update_fields.append("provider = ?")
                        update_values.append(provider_value)
                    if "provider_account_id" in self._user_columns:
                        if provider_account_id is not None:
                            update_fields.append("provider_account_id = ?")
                            update_values.append(provider_account_id)
                        elif provider_value == "magic_link":
                            update_fields.append("provider_account_id = ?")
                            update_values.append("")
                    if "name" in self._user_columns and name is not None:
                        update_fields.append("name = ?")
                        update_values.append(name)
                    if "avatar_url" in self._user_columns and avatar_url is not None:
                        update_fields.append("avatar_url = ?")
                        update_values.append(avatar_url)
                    if "updated_at" in self._user_columns:
                        update_fields.append("updated_at = ?")
                        update_values.append(now)
                    self._connection.execute(
                        f"""
                        UPDATE users
                        SET {', '.join(update_fields)}
                        WHERE user_id = ?
                        """,
                        (*update_values, user_id),
                    )
                else:
                    user_id = uuid4().hex
                    created_at = now
                    insert_columns = ["user_id", "email"]
                    insert_values: list[Any] = [user_id, normalized_email]
                    if "name" in self._user_columns:
                        insert_columns.append("name")
                        insert_values.append(
                            name if name is not None else (normalized_email if provider_value == "magic_link" else None)
                        )
                    if "avatar_url" in self._user_columns:
                        insert_columns.append("avatar_url")
                        insert_values.append(avatar_url)
                    insert_columns.extend(["token_hash", "created_at", "last_login_at"])
                    insert_values.extend([token_hash, created_at, now])
                    if "provider" in self._user_columns:
                        insert_columns.append("provider")
                        insert_values.append(provider_value)
                    if "provider_account_id" in self._user_columns:
                        insert_columns.append("provider_account_id")
                        insert_values.append(provider_account_id or "")
                    if "updated_at" in self._user_columns:
                        insert_columns.append("updated_at")
                        insert_values.append(now)
                    placeholders = ", ".join(["?"] * len(insert_columns))
                    columns_clause = ", ".join(insert_columns)
                    self._connection.execute(
                        f"""
                        INSERT INTO users ({columns_clause})
                        VALUES ({placeholders})
                        """,
                        insert_values,
                    )
                self._connection.commit()
                cursor = self._connection.execute(
                    """
                    SELECT user_id, email, created_at, last_login_at, name, avatar_url, provider, provider_account_id
                    FROM users
                    WHERE user_id = ?
                    """,
                    (user_id,),
                )
                user_row = cursor.fetchone()
        except sqlite3.Error as exc:
            raise StorageError(f"Failed to persist user for '{email}': {exc}") from exc
        if user_row is None:
            raise StorageError(f"Failed to load user record for '{email}' after upsert")
        return dict(user_row)

    def get_user_by_token_hash(self, token_hash: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            cursor = self._connection.execute(
                """
                SELECT user_id, email, created_at, last_login_at, name, avatar_url, provider, provider_account_id
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
                SELECT user_id, email, created_at, last_login_at, name, avatar_url, provider, provider_account_id
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
        existing = self._get_columns(table)
        if column in existing:
            return
        self._connection.execute(statement)
        existing.add(column)
        if table == "users":
            self._user_columns = existing

    def _get_columns(self, table: str) -> set[str]:
        cursor = self._connection.execute(f"PRAGMA table_info({table})")
        return {row[1] for row in cursor.fetchall()}

    def _table_has_column(self, table: str, column: str) -> bool:
        return column in self._get_columns(table)


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
