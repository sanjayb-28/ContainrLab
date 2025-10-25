from __future__ import annotations

import base64
import binascii
from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import]
from pydantic import BaseModel, Field  # type: ignore[import]

from ..services.auth_service import AuthenticatedUser, ensure_session_owner, get_current_user
from ..services.runner_client import RunnerClient, get_runner_client
from ..services.storage import Storage, get_storage

router = APIRouter(prefix="/fs", tags=["filesystem"])


class ListResponseEntry(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int | None = None
    modified: float | None = None


class ListResponse(BaseModel):
    path: str
    entries: List[ListResponseEntry]
    exists: bool
    is_dir: bool


class ReadResponse(BaseModel):
    path: str
    encoding: str = "base64"
    content: str


class WriteRequest(BaseModel):
    session_id: str
    path: str
    content: str
    encoding: str = "base64"


class WriteResponse(BaseModel):
    ok: bool
    path: str


class CreateRequest(BaseModel):
    session_id: str
    path: str
    kind: Literal["file", "directory"] = "file"
    content: str | None = None
    encoding: str = "base64"


class CreateResponse(BaseModel):
    ok: bool
    path: str
    kind: Literal["file", "directory"]


class RenameRequest(BaseModel):
    session_id: str
    path: str
    new_path: str


class RenameResponse(BaseModel):
    ok: bool
    path: str
    new_path: str


class DeleteRequest(BaseModel):
    session_id: str
    path: str


class DeleteResponse(BaseModel):
    ok: bool
    path: str


@router.get("/{session_id}/list", response_model=ListResponse)
async def list_path(
    session_id: str,
    path: str | None = None,
    runner: RunnerClient = Depends(get_runner_client),
    storage: Storage = Depends(get_storage),
    user: AuthenticatedUser = Depends(get_current_user),
) -> ListResponse:
    ensure_session_owner(storage, session_id, user)
    payload = await runner.list_path(session_id=session_id, path=path)
    entries = [
        ListResponseEntry(
            name=item["name"],
            path=item["path"],
            is_dir=item["is_dir"],
            size=item.get("size"),
            modified=item.get("modified"),
        )
        for item in payload.get("entries", [])
    ]
    return ListResponse(
        path=payload.get("path", path or "/workspace"),
        entries=entries,
        exists=payload.get("exists", True),
        is_dir=payload.get("is_dir", True),
    )


@router.get("/{session_id}/read", response_model=ReadResponse)
async def read_file(
    session_id: str,
    path: str,
    runner: RunnerClient = Depends(get_runner_client),
    storage: Storage = Depends(get_storage),
    user: AuthenticatedUser = Depends(get_current_user),
) -> ReadResponse:
    ensure_session_owner(storage, session_id, user)
    payload = await runner.read_file(session_id=session_id, path=path)
    return ReadResponse(**payload)


@router.post("/write", response_model=WriteResponse)
async def write_file(
    request: WriteRequest,
    runner: RunnerClient = Depends(get_runner_client),
    storage: Storage = Depends(get_storage),
    user: AuthenticatedUser = Depends(get_current_user),
) -> WriteResponse:
    ensure_session_owner(storage, request.session_id, user)
    if request.encoding != "base64":
        raise HTTPException(status_code=400, detail="Only base64 encoding is supported")
    try:
        base64.b64decode(request.content)
    except (ValueError, binascii.Error) as exc:  # type: ignore[name-defined]
        raise HTTPException(status_code=400, detail="Invalid base64 payload") from exc
    payload = await runner.write_file(
        session_id=request.session_id,
        path=request.path,
        content_b64=request.content,
    )
    return WriteResponse(**payload)


@router.post("/create", response_model=CreateResponse)
async def create_entry(
    request: CreateRequest,
    runner: RunnerClient = Depends(get_runner_client),
    storage: Storage = Depends(get_storage),
    user: AuthenticatedUser = Depends(get_current_user),
) -> CreateResponse:
    ensure_session_owner(storage, request.session_id, user)
    if request.kind == "file":
        if request.encoding != "base64":
            raise HTTPException(status_code=400, detail="Only base64 encoding is supported")
        try:
            base64.b64decode(request.content or "")
        except (ValueError, binascii.Error) as exc:  # type: ignore[name-defined]
            raise HTTPException(status_code=400, detail="Invalid base64 payload") from exc
    payload = await runner.create_entry(
        session_id=request.session_id,
        path=request.path,
        kind=request.kind,
        content_b64=request.content if request.kind == "file" else None,
    )
    return CreateResponse(**payload)


@router.post("/rename", response_model=RenameResponse)
async def rename_entry(
    request: RenameRequest,
    runner: RunnerClient = Depends(get_runner_client),
    storage: Storage = Depends(get_storage),
    user: AuthenticatedUser = Depends(get_current_user),
) -> RenameResponse:
    ensure_session_owner(storage, request.session_id, user)
    payload = await runner.rename_entry(
        session_id=request.session_id,
        path=request.path,
        new_path=request.new_path,
    )
    return RenameResponse(**payload)


@router.post("/delete", response_model=DeleteResponse)
async def delete_entry(
    request: DeleteRequest,
    runner: RunnerClient = Depends(get_runner_client),
    storage: Storage = Depends(get_storage),
    user: AuthenticatedUser = Depends(get_current_user),
) -> DeleteResponse:
    ensure_session_owner(storage, request.session_id, user)
    payload = await runner.delete_entry(session_id=request.session_id, path=request.path)
    return DeleteResponse(**payload)
