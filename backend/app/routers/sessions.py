from __future__ import annotations

from typing import Any, Dict

import httpx  # type: ignore[import]
from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import]
from pydantic import BaseModel, Field  # type: ignore[import]

from ..services.runner_client import RunnerClient, get_runner_client

router = APIRouter(prefix="/sessions", tags=["sessions"])


class BuildRequestBody(BaseModel):
    context_path: str = "/workspace"
    dockerfile_path: str = "Dockerfile"
    image_tag: str | None = None
    build_args: Dict[str, str] = Field(default_factory=dict)


class BuildResponse(BaseModel):
    image_tag: str
    logs: list[str]
    metrics: Dict[str, Any]


@router.post("/{session_id}/build", response_model=BuildResponse)
async def build_session_image(
    session_id: str,
    request: BuildRequestBody,
    runner: RunnerClient = Depends(get_runner_client),
) -> BuildResponse:
    try:
        runner_payload = await runner.build(
            session_id=session_id,
            context_path=request.context_path,
            dockerfile_path=request.dockerfile_path,
            image_tag=request.image_tag,
            build_args=request.build_args,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.json() if exc.response.headers.get("content-type", "").startswith("application/json") else exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Runner service unavailable: {exc}") from exc

    return BuildResponse(**runner_payload)
