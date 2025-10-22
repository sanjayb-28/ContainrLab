from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict

from fastapi import HTTPException

from judge import JudgeResult
from judge.labs import evaluate_lab1, evaluate_lab2
from .runner_client import RunnerClient


LabHandler = Callable[[str, RunnerClient], Awaitable[JudgeResult]]


class JudgeService:
    """Dispatch lab checks to the appropriate judge implementation."""

    def __init__(self) -> None:
        self._handlers: Dict[str, LabHandler] = {
            "lab1": evaluate_lab1,
            "lab2": evaluate_lab2,
        }

    async def evaluate(self, lab_slug: str, session_id: str, runner: RunnerClient) -> JudgeResult:
        handler = self._handlers.get(lab_slug)
        if handler is None:
            raise HTTPException(status_code=404, detail=f"No judge available for lab '{lab_slug}'")
        return await handler(session_id, runner)


def get_judge_service() -> JudgeService:
    return JudgeService()
