from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

from .storage import Storage, StorageError, get_storage


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str
    token: str


async def get_current_user(
    authorization: str | None = Header(default=None),
    storage: Storage = Depends(get_storage),
) -> AuthenticatedUser:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")
    token = parts[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token")
    user = storage.get_user_by_token_hash(hash_token(token))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return AuthenticatedUser(user_id=user["user_id"], email=user["email"], token=token)


def ensure_session_owner(storage: Storage, session_id: str, user: AuthenticatedUser) -> dict:
    try:
        return storage.assert_session_owner(session_id, user.user_id)
    except StorageError as exc:
        message = str(exc)
        if "not found" in message:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message) from exc
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message) from exc
