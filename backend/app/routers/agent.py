from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..services.agent_service import AgentRateLimitError, AgentService, get_agent_service

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


@router.post("/hint", response_model=AgentResponse)
async def agent_hint(
    request: AgentRequest,
    agent: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    try:
        result = await agent.generate_hint(
            request.session_id,
            request.prompt,
            lab_slug=request.lab_slug,
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
) -> AgentResponse:
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    try:
        result = await agent.generate_explanation(
            request.session_id,
            request.prompt,
            lab_slug=request.lab_slug,
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
