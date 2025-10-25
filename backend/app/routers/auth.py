from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from ..services.auth_service import AuthenticatedUser, generate_token, get_current_user, hash_token
from ..services.storage import Storage, StorageError, get_storage

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if "@" not in cleaned or cleaned.startswith("@") or cleaned.endswith("@"):
            raise ValueError("Invalid email address")
        return cleaned


class LoginResponse(BaseModel):
    user_id: str
    email: str
    token: str
    created_at: str
    last_login_at: str


class MeResponse(BaseModel):
    user_id: str
    email: str
    created_at: str
    last_login_at: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, storage: Storage = Depends(get_storage)) -> LoginResponse:
    token = generate_token()
    token_hash = hash_token(token)
    email = request.email
    try:
        user = storage.upsert_user_token(email, token_hash)
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return LoginResponse(
        user_id=user["user_id"],
        email=user["email"],
        token=token,
        created_at=user["created_at"],
        last_login_at=user["last_login_at"],
    )


@router.get("/me", response_model=MeResponse)
async def me(
    current_user: AuthenticatedUser = Depends(get_current_user),
    storage: Storage = Depends(get_storage),
) -> MeResponse:
    user = storage.get_user_by_id(current_user.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return MeResponse(
        user_id=user["user_id"],
        email=user["email"],
        created_at=user["created_at"],
        last_login_at=user["last_login_at"],
    )
