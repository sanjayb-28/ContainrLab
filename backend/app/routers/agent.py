from __future__ import annotations

import base64
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..services.agent_context import build_agent_context
from ..services.agent_service import (
    AgentPatchResult,
    AgentRateLimitError,
    AgentService,
    get_agent_service,
)
from ..services.auth_service import AuthenticatedUser, ensure_session_owner, get_current_user
from ..services.lab_catalog import LabCatalog, get_lab_catalog
from ..services.runner_client import RunnerClient, get_runner_client
from ..services.storage import Storage, get_storage

logger = logging.getLogger("containrlab.agent.router")

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    session_id: str = Field(..., description="Active session identifier")
    prompt: str = Field(..., description="Learner prompt")
    lab_slug: str | None = Field(None, description="Associated lab slug, if known.")


class AgentResponse(BaseModel):
    session_id: str
    prompt: str
    answer: str
    source: str


class PatchFile(BaseModel):
    path: str = Field(..., description="Absolute path (inside /workspace) of the file to update.")
    content: str = Field(..., description="Full file content after applying the patch.")
    description: str | None = Field(None, description="Optional human-readable explanation of the change.")


class PatchResponse(BaseModel):
    session_id: str
    prompt: str
    message: str
    files: list[PatchFile]
    source: str


class PatchApplyRequest(BaseModel):
    session_id: str
    files: list[PatchFile]


class PatchApplyResponse(BaseModel):
    session_id: str
    applied: list[str]


async def _resolve_lab_and_context(
    request: AgentRequest,
    *,
    storage: Storage,
    runner: RunnerClient,
    catalog: LabCatalog,
) -> tuple[str | None, str | None]:
    session = storage.get_session(request.session_id)
    resolved_slug = request.lab_slug or (session.get("lab_slug") if session else None)
    try:
        resolved_slug, context_text = await build_agent_context(
            session_id=request.session_id,
            runner=runner,
            lab_slug=resolved_slug,
            catalog=catalog,
        )
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to assemble agent context: %s", exc)
        context_text = None
    return resolved_slug, context_text


@router.post("/hint", response_model=AgentResponse)
async def agent_hint(
    request: AgentRequest,
    agent: AgentService = Depends(get_agent_service),
    storage: Storage = Depends(get_storage),
    runner: RunnerClient = Depends(get_runner_client),
    catalog: LabCatalog = Depends(get_lab_catalog),
    user: AuthenticatedUser = Depends(get_current_user),
) -> AgentResponse:
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    ensure_session_owner(storage, request.session_id, user)
    lab_slug, context_text = await _resolve_lab_and_context(
        request,
        storage=storage,
        runner=runner,
        catalog=catalog,
    )
    try:
        result = await agent.generate_hint(
            request.session_id,
            request.prompt,
            lab_slug=lab_slug,
            context=context_text,
        )
    except AgentRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AgentResponse(
        session_id=request.session_id,
        prompt=request.prompt,
        answer=result.answer,
        source=result.source,
    )


@router.post("/explain", response_model=AgentResponse)
async def agent_explain(
    request: AgentRequest,
    agent: AgentService = Depends(get_agent_service),
    storage: Storage = Depends(get_storage),
    runner: RunnerClient = Depends(get_runner_client),
    catalog: LabCatalog = Depends(get_lab_catalog),
    user: AuthenticatedUser = Depends(get_current_user),
) -> AgentResponse:
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    ensure_session_owner(storage, request.session_id, user)
    lab_slug, context_text = await _resolve_lab_and_context(
        request,
        storage=storage,
        runner=runner,
        catalog=catalog,
    )
    try:
        result = await agent.generate_explanation(
            request.session_id,
            request.prompt,
            lab_slug=lab_slug,
            context=context_text,
        )
    except AgentRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AgentResponse(
        session_id=request.session_id,
        prompt=request.prompt,
        answer=result.answer,
        source=result.source,
    )


@router.post("/patch", response_model=PatchResponse)
async def agent_patch(
    request: AgentRequest,
    agent: AgentService = Depends(get_agent_service),
    storage: Storage = Depends(get_storage),
    runner: RunnerClient = Depends(get_runner_client),
    catalog: LabCatalog = Depends(get_lab_catalog),
    user: AuthenticatedUser = Depends(get_current_user),
) -> PatchResponse:
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    ensure_session_owner(storage, request.session_id, user)
    lab_slug, context_text = await _resolve_lab_and_context(
        request,
        storage=storage,
        runner=runner,
        catalog=catalog,
    )
    try:
        result = await agent.generate_patch(
            request.session_id,
            request.prompt,
            lab_slug=lab_slug,
            context=context_text,
        )
    except AgentRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PatchResponse(
        session_id=request.session_id,
        prompt=request.prompt,
        message=result.message,
        files=[
            PatchFile(path=file.path, content=file.content, description=file.description)
            for file in result.files
        ],
        source=result.source,
    )


@router.post("/patch/apply", response_model=PatchApplyResponse)
async def agent_patch_apply(
    request: PatchApplyRequest,
    agent: AgentService = Depends(get_agent_service),  # noqa: ARG001 - symmetry with other routes
    storage: Storage = Depends(get_storage),
    user: AuthenticatedUser = Depends(get_current_user),
    runner: RunnerClient = Depends(get_runner_client),
) -> PatchApplyResponse:
    if not request.files:
        return PatchApplyResponse(session_id=request.session_id, applied=[])
    _ = agent  # maintain dependency symmetry for test overrides
    ensure_session_owner(storage, request.session_id, user)

    applied: list[str] = []
    for file in request.files:
        if not file.path.startswith("/workspace"):
            raise HTTPException(status_code=400, detail=f"Invalid path '{file.path}'. Paths must start with /workspace")
        content_bytes = file.content.encode("utf-8")
        content_b64 = base64.b64encode(content_bytes).decode("ascii")
        try:
            await runner.write_file(
                session_id=request.session_id,
                path=file.path,
                content_b64=content_b64,
            )
        except httpx.HTTPStatusError as exc:
            detail = (
                exc.response.json()
                if exc.response.headers.get("content-type", "").startswith("application/json")
                else exc.response.text
            )
            raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Runner service unavailable: {exc}") from exc
        applied.append(file.path)

    return PatchApplyResponse(session_id=request.session_id, applied=applied)
