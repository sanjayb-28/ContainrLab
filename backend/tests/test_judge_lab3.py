from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

import sys
from pathlib import Path

import httpx  # type: ignore[import]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from judge.labs.lab3 import evaluate  # noqa: E402


SUCCESS_DOCKERFILE = """
FROM node:20-bullseye AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD [\"npm\", \"start\"]
"""

SINGLE_STAGE_DOCKERFILE = """
FROM node:20
WORKDIR /app
COPY . .
RUN npm install && npm run build
CMD [\"npm\", \"start\"]
"""

ALIAS_MISSING_DOCKERFILE = """
FROM node:20
WORKDIR /app
RUN npm install
FROM node:20-alpine
COPY . .
EXPOSE 8080
CMD [\"npm\", \"start\"]
"""

MISSING_COPY_DOCKERFILE = """
FROM node:20 AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM node:20-alpine
WORKDIR /app
COPY . .
CMD [\"npm\", \"start\"]
"""


class FakeRunner:
    def __init__(
        self,
        *,
        dockerfile: str,
        image_size_mb: float = 120.0,
        build_success: bool = True,
        health_success: bool = True,
    ) -> None:
        self._dockerfile = dockerfile
        self._build_success = build_success
        self._health_success = health_success
        self._image_size_mb = image_size_mb
        self.exec_invocations: list[list[str]] = []

    async def exec(
        self,
        session_id: str,
        *,
        command: list[str],
        workdir: str | None = None,
        environment: Dict[str, str] | None = None,
    ) -> Dict[str, Any]:
        joined = " ".join(command)
        self.exec_invocations.append(command)
        if "cat /workspace/Dockerfile" in joined:
            return {"exit_code": 0, "logs": self._dockerfile.strip().splitlines()}
        if "curl" in joined:
            status = "200" if self._health_success else "500"
            exit_code = 0 if self._health_success else 7
            return {"exit_code": exit_code, "logs": [status]}
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
        if not self._build_success:
            response = httpx.Response(
                status_code=500,
                json={"error": "docker build failed", "logs": ["boom"]},
                request=httpx.Request("POST", "http://runner/build"),
            )
            raise httpx.HTTPStatusError("boom", request=response.request, response=response)
        return {
            "image_tag": image_tag,
            "logs": ["build log"],
            "metrics": {
                "image_size_mb": self._image_size_mb,
                "elapsed_seconds": 12.3,
                "layer_count": 8,
            },
        }

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
        return {
            "container_name": "rl_app_test",
            "logs": ["running"],
            "elapsed_seconds": 0.25,
        }

    async def stop_run(
        self,
        session_id: str,
        *,
        container_name: str | None = None,
        timeout: int = 10,
        remove: bool = True,
        ignore_missing: bool = True,
    ) -> Dict[str, Any]:
        return {"ok": True, "stopped": True, "removed": True, "logs": []}


def test_lab3_success() -> None:
    runner = FakeRunner(dockerfile=SUCCESS_DOCKERFILE)
    result = asyncio.run(evaluate("session", runner))
    assert result.passed is True
    assert not result.failures
    assert result.metrics["build"]["image_size_mb"] == runner._image_size_mb


def test_lab3_single_stage_rejected() -> None:
    runner = FakeRunner(dockerfile=SINGLE_STAGE_DOCKERFILE)
    result = asyncio.run(evaluate("session", runner))
    assert result.passed is False
    assert any(failure.code == "single_stage" for failure in result.failures)


def test_lab3_alias_missing_rejected() -> None:
    runner = FakeRunner(dockerfile=ALIAS_MISSING_DOCKERFILE)
    result = asyncio.run(evaluate("session", runner))
    assert result.passed is False
    assert any(failure.code == "builder_alias_missing" for failure in result.failures)


def test_lab3_missing_copy_from_rejected() -> None:
    runner = FakeRunner(dockerfile=MISSING_COPY_DOCKERFILE)
    result = asyncio.run(evaluate("session", runner))
    assert result.passed is False
    assert any(failure.code == "copy_from_missing" for failure in result.failures)


def test_lab3_image_size_rejected() -> None:
    runner = FakeRunner(dockerfile=SUCCESS_DOCKERFILE, image_size_mb=300.0)
    result = asyncio.run(evaluate("session", runner))
    assert result.passed is False
    assert any(failure.code == "image_too_large" for failure in result.failures)


def test_lab3_health_failure() -> None:
    runner = FakeRunner(dockerfile=SUCCESS_DOCKERFILE, health_success=False)
    result = asyncio.run(evaluate("session", runner))
    assert result.passed is False
    assert any(failure.code == "healthcheck_failed" for failure in result.failures)
