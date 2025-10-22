from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

import sys
from pathlib import Path

import httpx  # type: ignore[import]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from judge.labs.lab1 import evaluate


class FakeRunner:
    def __init__(
        self,
        *,
        dockerignore_content: Optional[str] = None,
        build_response: Optional[Dict[str, Any]] = None,
        run_response: Optional[Dict[str, Any]] = None,
        health_success: bool = True,
    ) -> None:
        self._dockerignore_content = dockerignore_content
        self._build_response = build_response or {
            "image_tag": "containrlab/test:latest",
            "logs": ["Step 1/1"],
            "metrics": {"elapsed_seconds": 1.23, "image_size_mb": 42.0},
        }
        self._run_response = run_response or {
            "container_name": "rl_app_123",
            "logs": ["running"],
            "elapsed_seconds": 0.25,
        }
        self._health_success = health_success
        self.stop_calls: list[Dict[str, Any]] = []
        self.exec_invocations: list[list[str]] = []

    async def exec(
        self,
        session_id: str,
        *,
        command: list[str],
        workdir: str | None = None,
        environment: Dict[str, str] | None = None,
    ) -> Dict[str, Any]:
        self.exec_invocations.append(command)
        joined = " ".join(command)
        if "cat /workspace/.dockerignore" in joined:
            if self._dockerignore_content is None:
                return {"exit_code": 1, "logs": []}
            return {"exit_code": 0, "logs": self._dockerignore_content.splitlines()}
        if "curl" in joined:
            if self._health_success:
                return {"exit_code": 0, "logs": ["200"]}
            return {"exit_code": 7, "logs": ["000"]}
        raise AssertionError(f"Unexpected exec command: {command}")

    async def build(
        self,
        session_id: str,
        *,
        context_path: str = "/workspace",
        dockerfile_path: str = "Dockerfile",
        image_tag: str | None = None,
        build_args: Dict[str, str] | None = None,
    ) -> Dict[str, Any]:
        return self._build_response

    async def run(
        self,
        session_id: str,
        *,
        image: str,
        command: list[str] | None = None,
        env: Dict[str, str] | None = None,
        ports: list[str] | None = None,
        name: str | None = None,
        detach: bool = True,
        auto_remove: bool = False,
        remove_existing: bool = True,
    ) -> Dict[str, Any]:
        return self._run_response

    async def stop_run(
        self,
        session_id: str,
        *,
        container_name: str | None = None,
        timeout: int = 10,
        remove: bool = True,
        ignore_missing: bool = True,
    ) -> Dict[str, Any]:
        call = {
            "session_id": session_id,
            "container_name": container_name,
            "timeout": timeout,
            "remove": remove,
            "ignore_missing": ignore_missing,
        }
        self.stop_calls.append(call)
        return {"ok": True, "stopped": True, "removed": True, "logs": []}


def test_lab1_success() -> None:
    runner = FakeRunner(
        dockerignore_content="node_modules\nvenv\n",
    )
    result = asyncio.run(evaluate("abc123", runner))
    assert result.passed is True
    assert not result.failures
    assert result.metrics["build"]["elapsed_seconds"] == runner._build_response["metrics"]["elapsed_seconds"]
    assert runner.stop_calls  # container cleanup triggered


def test_lab1_missing_dockerignore_entries() -> None:
    runner = FakeRunner(
        dockerignore_content="node_modules\n",
    )
    result = asyncio.run(evaluate("abc123", runner))
    assert result.passed is False
    assert any(failure.code == "dockerignore_missing_entries" for failure in result.failures)


def test_lab1_build_failure() -> None:
    response = httpx.Response(
        status_code=500,
        json={"error": "docker build failed", "logs": ["boom"]},
        request=httpx.Request("POST", "http://runner/build"),
    )
    runner = FakeRunner(dockerignore_content="node_modules\nvenv\n")

    async def failing_build(*args: Any, **kwargs: Any) -> Dict[str, Any]:
        raise httpx.HTTPStatusError("boom", request=response.request, response=response)

    runner.build = failing_build  # type: ignore[assignment]
    result = asyncio.run(evaluate("abc123", runner))
    assert result.passed is False
    assert any(failure.code == "docker_build_failed" for failure in result.failures)
    assert result.notes.get("build_logs") == ["boom"]
