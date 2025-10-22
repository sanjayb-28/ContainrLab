from __future__ import annotations

from typing import Any, Dict

import httpx  # type: ignore[import]

from judge.models import JudgeResult
from .lab1 import RunnerProtocol


async def evaluate(session_id: str, runner: RunnerProtocol) -> JudgeResult:
    result = JudgeResult(passed=True)

    dockerfile = await _read_dockerfile(session_id, runner, result)
    if dockerfile:
        _validate_dockerfile_order(dockerfile, result)
        _validate_pip_flags(dockerfile, result)

    build_info = await _attempt_build(session_id, runner, result)
    if not build_info:
        return result

    result.metrics["build"] = build_info.get("metrics", {})
    result.notes["build_logs"] = build_info.get("logs", [])

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
            hint="Place a Dockerfile at the repository root.",
        )
        return None
    return "\n".join(response.get("logs", []))


def _normalise_instructions(contents: str) -> list[str]:
    instructions: list[str] = []
    for raw in contents.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        instructions.append(line.lower())
    return instructions


def _validate_dockerfile_order(contents: str, result: JudgeResult) -> None:
    instructions = _normalise_instructions(contents)
    try:
        copy_requirements_idx = next(
            idx
            for idx, item in enumerate(instructions)
            if item.startswith("copy ") and "requirements" in item
        )
    except StopIteration:
        result.add_failure(
            code="copy_requirements_missing",
            message="Dockerfile must copy requirements.txt explicitly before other files.",
            hint="Add `COPY requirements.txt requirements.txt` before installing dependencies.",
        )
        return

    try:
        pip_install_idx = next(
            idx for idx, item in enumerate(instructions) if item.startswith("run ") and "pip" in item and "install" in item
        )
    except StopIteration:
        result.add_failure(
            code="pip_install_missing",
            message="Dockerfile must install Python dependencies with pip.",
            hint="Add a `RUN pip install --no-cache-dir -r requirements.txt` instruction.",
        )
        return

    try:
        copy_all_idx = next(
            idx for idx, item in enumerate(instructions) if item.startswith("copy .") or item.startswith("copy ./")
        )
    except StopIteration:
        result.add_failure(
            code="copy_source_missing",
            message="Dockerfile must copy application source after installing dependencies.",
            hint="Add `COPY . .` near the end of the Dockerfile.",
        )
        return

    if not (copy_requirements_idx < pip_install_idx < copy_all_idx):
        result.add_failure(
            code="layer_order_incorrect",
            message="Optimise layer order: copy requirements, install dependencies, then copy the rest of the source.",
            hint="Place `COPY requirements.txt` before the pip install layer, and keep `COPY . .` afterwards.",
        )


def _validate_pip_flags(contents: str, result: JudgeResult) -> None:
    lowered = contents.lower()
    if "pip install" not in lowered:
        return
    if "--no-cache-dir" not in lowered:
        result.add_failure(
            code="pip_cache_flag_missing",
            message="Use `--no-cache-dir` when installing dependencies to keep layers small.",
            hint="Update the pip install command to include `--no-cache-dir`.",
        )


async def _attempt_build(session_id: str, runner: RunnerProtocol, result: JudgeResult) -> Dict[str, Any] | None:
    image_tag = f"containrlab/lab2-{session_id[:12]}"
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


def _extract_runner_detail(exc: httpx.HTTPStatusError) -> Dict[str, Any] | str:
    try:
        return exc.response.json()
    except ValueError:
        return exc.response.text
