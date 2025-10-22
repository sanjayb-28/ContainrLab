from __future__ import annotations

import base64
import binascii
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import]
from pydantic import BaseModel, Field  # type: ignore[import]

from ..services.runner_client import RunnerClient, get_runner_client

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


@router.get("/{session_id}/list", response_model=ListResponse)
async def list_path(
    session_id: str,
    path: str | None = None,
    runner: RunnerClient = Depends(get_runner_client),
) -> ListResponse:
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
    return ListResponse(path=path or "/workspace", entries=entries)


@router.get("/{session_id}/read", response_model=ReadResponse)
async def read_file(
    session_id: str,
    path: str,
    runner: RunnerClient = Depends(get_runner_client),
) -> ReadResponse:
    payload = await runner.read_file(session_id=session_id, path=path)
    return ReadResponse(**payload)


@router.post("/write", response_model=WriteResponse)
async def write_file(
    request: WriteRequest,
    runner: RunnerClient = Depends(get_runner_client),
) -> WriteResponse:
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
