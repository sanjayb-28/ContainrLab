from __future__ import annotations

from typing import Any, Dict, List

import httpx  # type: ignore[import]

from judge.models import JudgeResult
from .lab1 import (  # noqa: F401 - reuse RunnerProtocol utilities
    DEFAULT_PORT,
    HEALTH_PATH,
    RunnerProtocol,
    _probe_health,
    _safe_stop,
    _extract_runner_detail,
)

MAX_IMAGE_MB = 250.0


async def evaluate(session_id: str, runner: RunnerProtocol) -> JudgeResult:
    result = JudgeResult(passed=True)

    dockerfile = await _read_dockerfile(session_id, runner, result)
    builder_alias = _validate_multistage(dockerfile, result) if dockerfile else None

    build_info = await _attempt_build(session_id, runner, result)
    if not build_info:
        return result

    run_info = await _exercise_container(session_id, runner, result)
    if run_info:
        result.metrics.setdefault("run", {})["elapsed_seconds"] = run_info.get("elapsed_seconds")

    return result


async def _read_dockerfile(session_id: str, runner: RunnerProtocol, result: JudgeResult) -> str | None:
    response = await runner.exec(
        session_id=session_id,
        command=["sh", "-lc", "cat /workspace/Dockerfile"],
    )
    if response.get("exit_code", 1) != 0:
        result.add_failure(
            code="dockerfile_missing",
            message="Missing Dockerfile in the workspace.",
            hint="Place a Dockerfile at the repository root and ensure the filename is capitalised.",
        )
        return None
    return "\n".join(response.get("logs", []))


def _validate_multistage(contents: str, result: JudgeResult) -> str | None:
    lines = _normalise_instructions(contents)
    from_lines = [line for line in lines if line.lower().startswith("from ")]
    if len(from_lines) < 2:
        result.add_failure(
            code="single_stage",
            message="Use a multi-stage Dockerfile so build tooling stays out of the final image.",
            hint="Add a builder stage (e.g. `FROM node:20 AS builder`) and copy only the artefacts you need into the runtime stage.",
        )
        return None

    builder_line = from_lines[0]
    builder_alias = _extract_alias(builder_line)
    if builder_alias is None:
        result.add_failure(
            code="builder_alias_missing",
            message="Name the first stage so you can COPY artefacts from it.",
            hint="Add `AS builder` (or similar) to the first FROM instruction.",
        )
        return None

    if not _has_copy_from(lines, builder_alias):
        result.add_failure(
            code="copy_from_missing",
            message="Copy artefacts from the builder stage rather than rebuilding in the runtime image.",
            hint=f"Use `COPY --from={builder_alias} ...` to bring built assets into the final stage.",
        )

    return builder_alias


async def _attempt_build(session_id: str, runner: RunnerProtocol, result: JudgeResult) -> Dict[str, Any] | None:
    image_tag = f"containrlab/lab3-{session_id[:12]}"
    try:
        build_response = await runner.build(
            session_id=session_id,
            context_path="/workspace",
            dockerfile_path="Dockerfile",
            image_tag=image_tag,
        )
    except httpx.HTTPStatusError as exc:
        detail = _extract_runner_detail(exc)
        hint = detail.get("hint") if isinstance(detail, dict) else None
        logs = detail.get("logs") if isinstance(detail, dict) else None
        if logs:
            result.notes.setdefault("build_logs", logs)
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

    metrics = build_response.get("metrics", {})
    result.metrics["build"] = metrics
    result.metrics["image_tag"] = build_response.get("image_tag") or image_tag
    result.notes.setdefault("build_logs", build_response.get("logs", []))

    size_mb = metrics.get("image_size_mb")
    if size_mb is not None and size_mb >= MAX_IMAGE_MB:
        size_str = f"{float(size_mb):.2f}"
        result.add_failure(
            code="image_too_large",
            message=f"Final image is too large ({size_str} MB). Aim for under {MAX_IMAGE_MB:.0f} MB.",
            hint="Move dev dependencies and build tooling to the builder stage and copy only the compiled output into the runtime image.",
        )

    return build_response


async def _exercise_container(session_id: str, runner: RunnerProtocol, result: JudgeResult) -> Dict[str, Any] | None:
    image_tag = result.metrics.get("image_tag")
    if not image_tag:
        image_tag = f"containrlab/lab3-{session_id[:12]}"

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
                hint="Ensure the app listens on port 8080 and keeps the /health endpoint returning 200.",
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


def _normalise_instructions(contents: str) -> List[str]:
    instructions: List[str] = []
    for raw in contents.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        instructions.append(line)
    return instructions


def _extract_alias(from_instruction: str) -> str | None:
    tokens = from_instruction.split()
    lowered = [token.lower() for token in tokens]
    if "as" in lowered:
        index = lowered.index("as")
        if index + 1 < len(tokens):
            return tokens[index + 1]
    return None


def _has_copy_from(lines: List[str], alias: str) -> bool:
    alias_lower = alias.lower()
    for line in lines:
        if line.lower().startswith("copy") and f"--from={alias_lower}" in line.lower():
            return True
    return False
