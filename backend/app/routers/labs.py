from __future__ import annotations

import os
import uuid

import httpx  # type: ignore[import]
from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import]
from pydantic import BaseModel  # type: ignore[import]

from ..services.runner_client import RunnerClient, get_runner_client

router = APIRouter(prefix="/labs", tags=["labs"])

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "2700"))


class LabStartResponse(BaseModel):
    session_id: str
    ttl: int
    runner_container: str


@router.post("/{lab_slug}/start", response_model=LabStartResponse)
async def start_lab(lab_slug: str, runner: RunnerClient = Depends(get_runner_client)) -> LabStartResponse:
    """Create a disposable runner session for the requested lab."""
    session_id = uuid.uuid4().hex
    try:
        runner_payload = await runner.start(session_id=session_id, lab_slug=lab_slug)
    except httpx.HTTPStatusError as exc:
        # Bubble runnerd errors to callers with useful context.
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Runner service unavailable: {exc}") from exc

    container_name = runner_payload.get("container")
    if not container_name:
        raise HTTPException(status_code=502, detail="Runner response missing container reference")

    return LabStartResponse(session_id=session_id, ttl=SESSION_TTL_SECONDS, runner_container=container_name)
