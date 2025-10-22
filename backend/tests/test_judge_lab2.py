from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

import sys
from pathlib import Path

import httpx  # type: ignore[import]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from judge.labs.lab2 import evaluate


class FakeRunner:
    def __init__(
        self,
        *,
        dockerfile: Optional[str] = None,
        build_response: Optional[Dict[str, Any]] = None,
    ) -> None:
        self._dockerfile = dockerfile
        self._build_response = build_response or {
            "image_tag": "containrlab/lab2:test",
            "logs": ["Step 1/3"],
            "metrics": {"elapsed_seconds": 2.0, "layer_count": 5},
        }
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
        if "cat /workspace/Dockerfile" in joined:
            if self._dockerfile is None:
                return {"exit_code": 1, "logs": []}
            return {"exit_code": 0, "logs": self._dockerfile.splitlines()}
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


def test_lab2_success() -> None:
    dockerfile = """
    FROM python:3.11-slim
    WORKDIR /app
    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt
    COPY . .
    CMD ["python", "app.py"]
    """
    runner = FakeRunner(dockerfile=dockerfile)
    result = asyncio.run(evaluate("session", runner))
    assert result.passed is True
    assert not result.failures
    assert result.metrics["build"]["layer_count"] == runner._build_response["metrics"]["layer_count"]


def test_lab2_bad_order() -> None:
    dockerfile = """
    FROM python:3.11-slim
    WORKDIR /app
    COPY . .
    RUN pip install --no-cache-dir -r requirements.txt
    COPY requirements.txt .
    CMD ["python", "app.py"]
    """
    runner = FakeRunner(dockerfile=dockerfile)
    result = asyncio.run(evaluate("session", runner))
    assert result.passed is False
    assert any(f.code == "layer_order_incorrect" for f in result.failures)


def test_lab2_build_failure() -> None:
    dockerfile = """
    FROM python:3.11-slim
    WORKDIR /app
    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt
    COPY . .
    """
    runner = FakeRunner(dockerfile=dockerfile)

    response = httpx.Response(
        status_code=500,
        json={"error": "docker build failed", "logs": ["boom"]},
        request=httpx.Request("POST", "http://runner/build"),
    )

    async def failing_build(*args: Any, **kwargs: Any) -> Dict[str, Any]:
        raise httpx.HTTPStatusError("boom", request=response.request, response=response)

    runner.build = failing_build  # type: ignore[assignment]
    result = asyncio.run(evaluate("session", runner))
    assert result.passed is False
    assert any(f.code == "docker_build_failed" for f in result.failures)
