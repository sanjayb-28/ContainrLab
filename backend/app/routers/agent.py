from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    session_id: str = Field(..., description="Active session identifier")
    prompt: str = Field(..., description="Learner prompt")


class AgentResponse(BaseModel):
    session_id: str
    prompt: str
    answer: str
    source: str = "stub"


STUB_HINT = "Remember to install dependencies before building."
STUB_EXPLAIN = (
    "Docker builds each instruction in order. Combine related commands to reduce layers "
    "and cache invalidations."
)


@router.post("/hint", response_model=AgentResponse)
async def agent_hint(request: AgentRequest) -> AgentResponse:
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    return AgentResponse(
        session_id=request.session_id,
        prompt=request.prompt,
        answer=STUB_HINT,
    )


@router.post("/explain", response_model=AgentResponse)
async def agent_explain(request: AgentRequest) -> AgentResponse:
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    return AgentResponse(
        session_id=request.session_id,
        prompt=request.prompt,
        answer=STUB_EXPLAIN,
    )
