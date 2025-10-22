from __future__ import annotations

import asyncio
from typing import Any, Dict, Protocol

import httpx  # type: ignore[import]

from judge.models import JudgeResult

REQUIRED_DOCKERIGNORE_PATTERNS = ("node_modules", "venv")
DEFAULT_PORT = 8080
HEALTH_PATH = "/health"


class RunnerProtocol(Protocol):
    async def build(
        self,
        session_id: str,
        *,
        context_path: str = "/workspace",
        dockerfile_path: str = "Dockerfile",
        image_tag: str | None = None,
        build_args: Dict[str, str] | None = None,
    ) -> Dict[str, Any]:
        ...

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
        ...

    async def stop_run(
        self,
        session_id: str,
        *,
        container_name: str | None = None,
        timeout: int = 10,
        remove: bool = True,
        ignore_missing: bool = True,
    ) -> Dict[str, Any]:
        ...

    async def exec(
        self,
        session_id: str,
        *,
        command: list[str],
        workdir: str | None = None,
        environment: Dict[str, str] | None = None,
    ) -> Dict[str, Any]:
        ...


async def evaluate(session_id: str, runner: RunnerProtocol) -> JudgeResult:
    """Run Lab 1 checks inside the learner's runner session."""
    result = JudgeResult(passed=True)

    dockerignore = await _read_dockerignore(session_id, runner, result)
    if dockerignore is not None:
        _validate_dockerignore(dockerignore, result)

    build_info = await _attempt_build(session_id, runner, result)
    if not build_info:
        return result

    image_tag = build_info["image_tag"]
    result.metrics["image_tag"] = image_tag
    result.metrics["build"] = build_info.get("metrics", {})
    result.notes["build_logs"] = build_info.get("logs", [])

    run_info = await _exercise_container(session_id, runner, image_tag, result)
    if run_info:
        result.metrics["run"] = {"elapsed_seconds": run_info.get("elapsed_seconds")}

    return result


async def _read_dockerignore(session_id: str, runner: RunnerProtocol, result: JudgeResult) -> str | None:
    response = await runner.exec(
        session_id=session_id,
        command=["sh", "-lc", "cat /workspace/.dockerignore"],
    )
    if response.get("exit_code", 1) != 0:
        result.add_failure(
            code="dockerignore_missing",
            message="Missing .dockerignore file in workspace.",
            hint="Create a .dockerignore file so sensitive and heavy directories stay out of the image context.",
        )
        return None
    return "\n".join(response.get("logs", []))


def _validate_dockerignore(contents: str, result: JudgeResult) -> None:
    lines = {
        line.strip()
        for line in contents.splitlines()
        if line.strip() and not line.strip().startswith("#")
    }
    missing = [
        pattern
        for pattern in REQUIRED_DOCKERIGNORE_PATTERNS
        if not any(pattern in line for line in lines)
    ]
    if missing:
        pretty = ", ".join(missing)
        result.add_failure(
            code="dockerignore_missing_entries",
            message=f".dockerignore should ignore: {pretty}",
            hint="Add the missing entries to reduce context size, for example 'node_modules' or 'venv/'.",
        )


async def _attempt_build(session_id: str, runner: RunnerProtocol, result: JudgeResult) -> Dict[str, Any] | None:
    image_tag = f"containrlab/lab1-{session_id[:12]}"
    try:
        build_response = await runner.build(
            session_id=session_id,
            context_path="/workspace",
            dockerfile_path="Dockerfile",
            image_tag=image_tag,
        )
        return build_response
    except httpx.HTTPStatusError as exc:
        detail = _extract_runner_detail(exc)
        hint = detail.get("hint") if isinstance(detail, dict) else None
        logs = detail.get("logs") if isinstance(detail, dict) else None
        if logs:
            result.notes["build_logs"] = logs
        result.add_failure(
            code="docker_build_failed",
            message="Docker build failed inside the runner.",
            hint=hint or (detail.get("error") if isinstance(detail, dict) else str(exc)),
        )
        return None
    except httpx.HTTPError as exc:
        result.add_failure(
            code="runner_unavailable",
            message="Failed to contact runner while building the image.",
            hint=str(exc),
        )
        return None


async def _exercise_container(session_id: str, runner: RunnerProtocol, image_tag: str, result: JudgeResult) -> Dict[str, Any] | None:
    container_name: str | None = None
    try:
        run_response = await runner.run(
            session_id=session_id,
            image=image_tag,
            command=[],
            ports=[f"{DEFAULT_PORT}:{DEFAULT_PORT}"],
            detach=True,
            auto_remove=False,
            remove_existing=True,
        )
        container_name = run_response.get("container_name")
        if not await _probe_health(session_id, runner):
            result.add_failure(
                code="healthcheck_failed",
                message=f"Container failed to respond on http://localhost:{DEFAULT_PORT}{HEALTH_PATH}.",
                hint="Ensure the app listens on port 8080 and exposes a /health endpoint that returns 200.",
            )
        return run_response
    except httpx.HTTPStatusError as exc:
        detail = _extract_runner_detail(exc)
        hint = detail.get("hint") if isinstance(detail, dict) else None
        logs = detail.get("logs") if isinstance(detail, dict) else None
        if logs:
            result.notes.setdefault("runtime_logs", logs)
        result.add_failure(
            code="docker_run_failed",
            message="docker run failed inside the runner.",
            hint=hint or (detail.get("error") if isinstance(detail, dict) else str(exc)),
        )
        return None
    except httpx.HTTPError as exc:
        result.add_failure(
            code="runner_unavailable",
            message="Failed to contact runner while running the container.",
            hint=str(exc),
        )
        return None
    finally:
        if container_name:
            await _safe_stop(session_id, runner, container_name)


async def _probe_health(session_id: str, runner: RunnerProtocol) -> bool:
    command = [
        "sh",
        "-lc",
        f"curl -sS -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{DEFAULT_PORT}{HEALTH_PATH}",
    ]
    for attempt in range(5):
        response = await runner.exec(session_id=session_id, command=command)
        exit_code = response.get("exit_code", 1)
        logs = response.get("logs", [])
        last_line = logs[-1] if logs else ""
        if exit_code == 0 and last_line.strip() == "200":
            return True
        await asyncio.sleep(1 + attempt * 0.5)
    return False


async def _safe_stop(session_id: str, runner: RunnerProtocol, container_name: str) -> None:
    try:
        await runner.stop_run(
            session_id=session_id,
            container_name=container_name,
            timeout=3,
            remove=True,
            ignore_missing=True,
        )
    except httpx.HTTPError:
        # Best effort cleanup; suppress errors so judging result still returns.
        return


def _extract_runner_detail(exc: httpx.HTTPStatusError) -> Dict[str, Any] | str:
    try:
        return exc.response.json()
    except ValueError:
        return exc.response.text
