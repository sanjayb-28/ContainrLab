from __future__ import annotations

import os
import uuid
from typing import Any, Dict

import httpx  # type: ignore[import]
from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import]
from pydantic import BaseModel  # type: ignore[import]

from ..services.auth_service import AuthenticatedUser, ensure_session_owner, get_current_user
from ..services.judge_service import JudgeService, get_judge_service
from ..services.lab_catalog import LabCatalog, get_lab_catalog
from ..services.runner_client import RunnerClient, get_runner_client
from ..services.storage import Storage, StorageError, get_storage

router = APIRouter(prefix="/labs", tags=["labs"])

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "2700"))


class LabStartResponse(BaseModel):
    session_id: str
    ttl: int
    runner_container: str
    expires_at: str


class LabListItem(BaseModel):
    slug: str
    title: str
    summary: str | None = None  # type: ignore[name-defined]
    has_starter: bool


class LabDetailResponse(LabListItem):
    description: str
    solution: str | None = None


class LabCheckRequest(BaseModel):
    session_id: str


class JudgeFailureResponse(BaseModel):
    code: str
    message: str
    hint: str | None = None  # type: ignore[name-defined]


class LabCheckResponse(BaseModel):
    passed: bool
    failures: list[JudgeFailureResponse]
    metrics: Dict[str, Any]
    notes: Dict[str, Any]


@router.post("/{lab_slug}/start", response_model=LabStartResponse)
async def start_lab(
    lab_slug: str,
    runner: RunnerClient = Depends(get_runner_client),
    storage: Storage = Depends(get_storage),
    user: AuthenticatedUser = Depends(get_current_user),
) -> LabStartResponse:
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

    try:
        session_record = storage.record_session(
            session_id=session_id,
            lab_slug=lab_slug,
            runner_container=container_name,
            ttl_seconds=SESSION_TTL_SECONDS,
            user_id=user.user_id,
        )
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    expires_at = session_record["expires_at"]
    return LabStartResponse(
        session_id=session_id,
        ttl=SESSION_TTL_SECONDS,
        runner_container=container_name,
        expires_at=expires_at,
    )


@router.get("", response_model=list[LabListItem])
async def list_labs(catalog: LabCatalog = Depends(get_lab_catalog)) -> list[LabListItem]:
    try:
        labs = catalog.list()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return [
        LabListItem(slug=lab.slug, title=lab.title, summary=lab.summary, has_starter=lab.has_starter)
        for lab in labs
    ]


@router.get("/{lab_slug}", response_model=LabDetailResponse)
async def get_lab(lab_slug: str, catalog: LabCatalog = Depends(get_lab_catalog)) -> LabDetailResponse:
    try:
        lab = catalog.get(lab_slug)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return LabDetailResponse(
        slug=lab.slug,
        title=lab.title,
        summary=lab.summary,
        has_starter=lab.has_starter,
        description=lab.description,
        solution=lab.solution,
    )


@router.post("/{lab_slug}/check", response_model=LabCheckResponse)
async def check_lab(
    lab_slug: str,
    request: LabCheckRequest,
    runner: RunnerClient = Depends(get_runner_client),
    judge: JudgeService = Depends(get_judge_service),
    storage: Storage = Depends(get_storage),
    user: AuthenticatedUser = Depends(get_current_user),
) -> LabCheckResponse:
    ensure_session_owner(storage, request.session_id, user)
    result = await judge.evaluate(lab_slug, request.session_id, runner)
    failures = [
        JudgeFailureResponse(code=failure.code, message=failure.message, hint=failure.hint)
        for failure in result.failures
    ]
    try:
        storage.record_attempt(session_id=request.session_id, lab_slug=lab_slug, result=result)
    except StorageError as exc:
        status = 404 if "not found" in str(exc).lower() else 500
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return LabCheckResponse(passed=result.passed, failures=failures, metrics=result.metrics, notes=result.notes)
