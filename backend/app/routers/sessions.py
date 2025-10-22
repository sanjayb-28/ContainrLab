from __future__ import annotations

from typing import Any, Dict, List

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


class RunRequestBody(BaseModel):
    image: str
    command: List[str] = Field(default_factory=list)
    env: Dict[str, str] = Field(default_factory=dict)
    ports: List[str] = Field(default_factory=list)
    name: str | None = None
    detach: bool = True
    auto_remove: bool = False
    remove_existing: bool = True


class RunResponse(BaseModel):
    container_name: str
    logs: list[str]
    elapsed_seconds: float


class RunStopRequestBody(BaseModel):
    container_name: str | None = None
    timeout: int = 10
    remove: bool = True
    ignore_missing: bool = True


class RunStopResponse(BaseModel):
    ok: bool
    stopped: bool
    removed: bool | None = None
    logs: list[str]


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


@router.post("/{session_id}/run", response_model=RunResponse)
async def run_session_container(
    session_id: str,
    request: RunRequestBody,
    runner: RunnerClient = Depends(get_runner_client),
) -> RunResponse:
    try:
        runner_payload = await runner.run(
            session_id=session_id,
            image=request.image,
            command=request.command,
            env=request.env,
            ports=request.ports,
            name=request.name,
            detach=request.detach,
            auto_remove=request.auto_remove,
            remove_existing=request.remove_existing,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.json() if exc.response.headers.get("content-type", "").startswith("application/json") else exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Runner service unavailable: {exc}") from exc

    return RunResponse(**runner_payload)


@router.post("/{session_id}/run/stop", response_model=RunStopResponse)
async def stop_session_container(
    session_id: str,
    request: RunStopRequestBody,
    runner: RunnerClient = Depends(get_runner_client),
) -> RunStopResponse:
    try:
        runner_payload = await runner.stop_run(
            session_id=session_id,
            container_name=request.container_name,
            timeout=request.timeout,
            remove=request.remove,
            ignore_missing=request.ignore_missing,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.json() if exc.response.headers.get("content-type", "").startswith("application/json") else exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Runner service unavailable: {exc}") from exc

    # Runner returns logs list even when the inner container is missing; ensure schema compatibility
    if "logs" not in runner_payload:
        runner_payload["logs"] = []
    return RunStopResponse(**runner_payload)
