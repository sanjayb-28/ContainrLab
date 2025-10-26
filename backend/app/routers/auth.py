from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

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
    name: str | None = None
    avatar_url: str | None = None


class MeResponse(BaseModel):
    user_id: str
    email: str
    created_at: str
    last_login_at: str
    name: str | None = None
    avatar_url: str | None = None


SUPPORTED_OAUTH_PROVIDERS: set[str] = {"github"}


class OAuthLoginRequest(BaseModel):
    email: str
    provider_account_id: str = Field(min_length=1)
    name: str | None = None
    avatar_url: str | None = None

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if "@" not in cleaned or cleaned.startswith("@") or cleaned.endswith("@"):
            raise ValueError("Invalid email address")
        return cleaned


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, storage: Storage = Depends(get_storage)) -> LoginResponse:
    token = generate_token()
    token_hash = hash_token(token)
    email = request.email
    try:
        user = storage.upsert_user_token(email, token_hash, provider="magic_link")
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return LoginResponse(
        user_id=user["user_id"],
        email=user["email"],
        token=token,
        created_at=user["created_at"],
        last_login_at=user["last_login_at"],
        name=user.get("name"),
        avatar_url=user.get("avatar_url"),
    )


@router.post("/oauth/{provider}", response_model=LoginResponse)
async def oauth_login(
    provider: str,
    request: OAuthLoginRequest,
    storage: Storage = Depends(get_storage),
) -> LoginResponse:
    provider_normalized = provider.lower()
    if provider_normalized not in SUPPORTED_OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported OAuth provider '{provider}'.")
    token = generate_token()
    token_hash = hash_token(token)
    try:
        user = storage.upsert_user_token(
            request.email,
            token_hash,
            provider=provider_normalized,
            provider_account_id=request.provider_account_id,
            name=request.name,
            avatar_url=request.avatar_url,
        )
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return LoginResponse(
        user_id=user["user_id"],
        email=user["email"],
        token=token,
        created_at=user["created_at"],
        last_login_at=user["last_login_at"],
        name=user.get("name"),
        avatar_url=user.get("avatar_url"),
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
        name=user.get("name"),
        avatar_url=user.get("avatar_url"),
    )
