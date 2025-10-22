from __future__ import annotations

import io
import os
import tarfile
import time
from pathlib import Path
from typing import Any, Dict, List

import docker  # type: ignore[import]
from docker.errors import APIError, NotFound  # type: ignore[import]
from fastapi import FastAPI, HTTPException  # type: ignore[import]
from pydantic import BaseModel, Field  # type: ignore[import]

app = FastAPI(title="runnerd")

client = docker.from_env()

RUNNER_IMAGE = os.getenv("RUNNER_IMAGE", "containrlab-runner:latest")
LABS_ROOT = Path(os.getenv("LABS_ROOT", "/labs"))
STARTUP_TIMEOUT = int(os.getenv("STARTUP_TIMEOUT", "30"))
MEMORY_LIMIT = os.getenv("RUNNER_MEMORY", "2g")
NANO_CPUS = int(os.getenv("RUNNER_NANO_CPUS", str(1_000_000_000)))
PIDS_LIMIT = int(os.getenv("RUNNER_PIDS_LIMIT", "1024"))
SOCKET_PATH = os.getenv("RUNNER_SOCKET_PATH", "/var/run/docker.sock")
MAX_LOG_LINES = 200


class StartRequest(BaseModel):
    session_id: str
    lab_slug: str


class StopRequest(BaseModel):
    session_id: str
    preserve_workspace: bool = False


class BuildRequest(BaseModel):
    session_id: str
    context_path: str = "/workspace"
    dockerfile_path: str = "Dockerfile"
    image_tag: str | None = None
    build_args: Dict[str, str] = Field(default_factory=dict)


class RunRequest(BaseModel):
    session_id: str
    image: str
    command: List[str] = Field(default_factory=list)
    env: Dict[str, str] = Field(default_factory=dict)
    ports: List[str] = Field(default_factory=list)
    name: str | None = None
    detach: bool = True
    auto_remove: bool = False
    remove_existing: bool = True


class RunStopRequest(BaseModel):
    session_id: str
    container_name: str | None = None
    timeout: int = 10
    remove: bool = True
    ignore_missing: bool = True


class ExecRequest(BaseModel):
    session_id: str
    command: List[str]
    workdir: str | None = None
    environment: Dict[str, str] = Field(default_factory=dict)


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    """Signal to the API layer that runnerd is reachable."""
    return {"ok": True}


@app.post("/start")
def start_runner(payload: StartRequest) -> dict[str, str]:
    container_name = _container_name(payload.session_id)
    volume_name = _volume_name(payload.session_id)
    starter_path = LABS_ROOT / payload.lab_slug / "starter"

    if not starter_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Starter assets not found for lab '{payload.lab_slug}'")

    volume = _ensure_volume(volume_name)
    _remove_container_if_exists(container_name)

    try:
        container = client.containers.run(
            RUNNER_IMAGE,
            name=container_name,
            detach=True,
            tty=True,
            environment={"DOCKER_TLS_CERTDIR": ""},
            privileged=True,
            mem_limit=MEMORY_LIMIT,
            nano_cpus=NANO_CPUS,
            pids_limit=PIDS_LIMIT,
            volumes={volume.name: {"bind": "/workspace", "mode": "rw"}},
        )
    except APIError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to start runner container: {exc.explanation}") from exc

    _wait_for_dockerd(container)
    _seed_workspace(container, starter_path)

    return {"session_id": payload.session_id, "container": container.name}


@app.post("/stop")
def stop_runner(payload: StopRequest) -> dict[str, bool]:
    container_name = _container_name(payload.session_id)
    volume_name = _volume_name(payload.session_id)

    _remove_container_if_exists(container_name)

    if not payload.preserve_workspace:
        try:
            volume = client.volumes.get(volume_name)
            volume.remove(force=True)
        except NotFound:
            pass
        except APIError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to remove workspace volume: {exc.explanation}") from exc

    return {"ok": True}


@app.post("/build")
def build_image(payload: BuildRequest) -> dict[str, Any]:
    container = _get_running_container(payload.session_id)
    if not payload.context_path.startswith("/"):
        raise HTTPException(status_code=400, detail="context_path must be absolute inside the runner")
    _assert_path_exists(container, payload.context_path, expect_directory=True)
    _assert_path_exists(container, payload.dockerfile_path, workdir=payload.context_path, expect_directory=False)

    image_tag = payload.image_tag or _default_image_tag(payload.session_id)
    command: List[str] = [
        "docker",
        "build",
        "-f",
        payload.dockerfile_path,
        "-t",
        image_tag,
    ]

    for key, value in payload.build_args.items():
        command.extend(["--build-arg", f"{key}={value}"])

    command.append(".")

    logs, exit_code, elapsed = _exec_docker_build(container, command, payload.context_path)
    trimmed_logs = _trim_logs(logs)

    if exit_code != 0:
        raise HTTPException(status_code=500, detail={"error": "docker build failed", "logs": trimmed_logs})

    metrics = _collect_image_metrics(container, image_tag, elapsed)

    return {"image_tag": image_tag, "logs": trimmed_logs, "metrics": metrics}


@app.post("/run")
def run_image(payload: RunRequest) -> Dict[str, Any]:
    container = _get_running_container(payload.session_id)
    inner_name = payload.name or _default_run_container_name(payload.session_id)

    if payload.remove_existing:
        _remove_inner_container(container, inner_name)

    command: List[str] = ["docker", "run"]

    if payload.detach:
        command.append("-d")
    if payload.auto_remove:
        command.append("--rm")

    command.extend(["--name", inner_name])

    for mapping in payload.ports:
        if ":" not in mapping:
            raise HTTPException(status_code=400, detail=f"Port mapping '{mapping}' must be in HOST:CONTAINER form")
        command.extend(["-p", mapping])

    for key, value in payload.env.items():
        command.extend(["-e", f"{key}={str(value)}"])

    command.append(payload.image)
    command.extend(payload.command)

    logs, exit_code, elapsed = _exec_docker_command(container, command)
    trimmed_logs = _trim_logs(logs)

    if exit_code != 0:
        raise HTTPException(status_code=500, detail={"error": "docker run failed", "logs": trimmed_logs})

    return {
        "container_name": inner_name,
        "logs": trimmed_logs,
        "elapsed_seconds": round(elapsed, 3),
    }


@app.post("/run/stop")
def stop_run(payload: RunStopRequest) -> Dict[str, Any]:
    container = _get_running_container(payload.session_id)
    inner_name = payload.container_name or _default_run_container_name(payload.session_id)

    if not _inner_container_exists(container, inner_name):
        if payload.ignore_missing:
            return {"ok": True, "stopped": False}
        raise HTTPException(status_code=404, detail="Inner container not found")

    stop_cmd: List[str] = ["docker", "stop", "-t", str(payload.timeout), inner_name]
    logs, exit_code, _ = _exec_docker_command(container, stop_cmd)
    trimmed_logs = _trim_logs(logs)

    if exit_code != 0 and not payload.ignore_missing:
        raise HTTPException(status_code=500, detail={"error": "Failed to stop inner container", "logs": trimmed_logs})

    removed: bool | None = None
    if payload.remove:
        rm_logs, rm_code, _ = _exec_docker_command(container, ["docker", "rm", inner_name])
        removed = rm_code == 0
        if rm_code != 0 and not payload.ignore_missing:
            raise HTTPException(status_code=500, detail={"error": "Failed to remove inner container", "logs": _trim_logs(rm_logs)})

    return {"ok": exit_code == 0, "stopped": exit_code == 0, "removed": removed, "logs": trimmed_logs}


@app.post("/exec")
def exec_in_runner(payload: ExecRequest) -> Dict[str, Any]:
    container = _get_running_container(payload.session_id)
    logs, exit_code, elapsed = _exec_container_command(
        container,
        payload.command,
        workdir=payload.workdir,
        environment=payload.environment,
    )
    trimmed_logs = _trim_logs(logs)
    return {"exit_code": exit_code, "logs": trimmed_logs, "elapsed_seconds": round(elapsed, 3)}


def _container_name(session_id: str) -> str:
    return f"rl_sess_{session_id[:32]}"


def _volume_name(session_id: str) -> str:
    return f"rl_ws_{session_id[:32]}"


def _ensure_volume(name: str):
    try:
        return client.volumes.get(name)
    except NotFound:
        return client.volumes.create(name=name, labels={"app": "containrlab"})


def _remove_container_if_exists(name: str) -> None:
    try:
        container = client.containers.get(name)
        container.remove(force=True)
    except NotFound:
        return
    except APIError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to remove existing container: {exc.explanation}") from exc


def _get_running_container(session_id: str):
    container_name = _container_name(session_id)
    try:
        container = client.containers.get(container_name)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail="Runner session not found") from exc
    container.reload()
    if container.status != "running":
        raise HTTPException(status_code=409, detail="Runner session is not running")
    return container


def _wait_for_dockerd(container) -> None:
    deadline = time.time() + STARTUP_TIMEOUT
    while time.time() < deadline:
        result = container.exec_run(["sh", "-c", f"test -S {SOCKET_PATH}"])
        if result.exit_code == 0:
            return
        time.sleep(1)
    container.remove(force=True)
    raise HTTPException(status_code=504, detail="Runner daemon failed to become ready in time")


def _seed_workspace(container, starter_path: Path) -> None:
    result = container.exec_run(["sh", "-c", "rm -rf /workspace/*"])
    if result.exit_code != 0:
        raise HTTPException(status_code=500, detail="Unable to clean workspace before seeding")

    archive = _build_tar(starter_path)
    ok = container.put_archive("/workspace", archive)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to seed workspace")


def _build_tar(path: Path) -> bytes:
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode="w") as tar:
        tar.add(path, arcname=".")
    data.seek(0)
    return data.read()

def _exec_container_command(
    container,
    command: List[str],
    *,
    workdir: str | None = None,
    environment: Dict[str, str] | None = None,
) -> tuple[List[str], int, float]:
    start = time.time()
    exec_result = container.exec_run(
        command,
        workdir=workdir,
        environment=environment or {},
        demux=False,
    )

    raw_output = exec_result.output or b""
    text = raw_output.decode("utf-8", errors="replace").replace("\r\n", "\n")
    logs = [line for line in text.split("\n") if line]

    exit_code = exec_result.exit_code or 0
    elapsed = time.time() - start
    return logs, exit_code, elapsed


def _exec_docker_command(
    container,
    command: List[str],
    *,
    workdir: str | None = None,
    environment: Dict[str, str] | None = None,
) -> tuple[List[str], int, float]:
    return _exec_container_command(container, command, workdir=workdir, environment=environment)


def _exec_docker_build(container, command: List[str], workdir: str) -> tuple[List[str], int, float]:
    return _exec_docker_command(container, command, workdir=workdir, environment={"DOCKER_BUILDKIT": "1"})


def _collect_image_metrics(container, image_tag: str, elapsed: float) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {"elapsed_seconds": round(elapsed, 3)}

    size_result = container.exec_run(["docker", "image", "inspect", image_tag, "--format", "{{.Size}}"])  # type: ignore[list-item]
    if size_result.exit_code == 0:
        raw = size_result.output.decode("utf-8", errors="replace").strip()
        try:
            size_bytes = int(raw)
        except ValueError:
            size_bytes = None
        if size_bytes is not None:
            metrics["image_size_bytes"] = size_bytes
            metrics["image_size_mb"] = round(size_bytes / (1024 * 1024), 2)

    layers_result = container.exec_run(["docker", "history", image_tag, "--format", "{{.ID}}"])  # type: ignore[list-item]
    if layers_result.exit_code == 0:
        entries = [line for line in layers_result.output.decode("utf-8", errors="replace").splitlines() if line.strip()]
        metrics["layer_count"] = len(entries)

    return metrics


def _trim_logs(logs: List[str], limit: int = MAX_LOG_LINES) -> List[str]:
    if len(logs) <= limit:
        return logs
    return ["... (truncated) ..."] + logs[-limit:]


def _assert_path_exists(container, path: str, *, workdir: str | None = None, expect_directory: bool) -> None:
    flag = "-d" if expect_directory else "-f"
    result = container.exec_run(["test", flag, path], workdir=workdir)
    if result.exit_code != 0:
        descriptor = "directory" if expect_directory else "file"
        raise HTTPException(status_code=404, detail=f"Expected {descriptor} '{path}' not found in runner")


def _default_image_tag(session_id: str) -> str:
    return f"containrlab/session-{session_id[:12]}:latest"


def _default_run_container_name(session_id: str) -> str:
    return f"rl_app_{session_id[:12]}"


def _remove_inner_container(container, name: str) -> None:
    if not _inner_container_exists(container, name):
        return
    container.exec_run(["docker", "rm", "-f", name])


def _inner_container_exists(container, name: str) -> bool:
    result = container.exec_run(
        ["docker", "ps", "-a", "--filter", f"name=^{name}$", "--format", "{{.ID}}"]
    )
    if result.exit_code != 0:
        return False
    return bool((result.output or b"").decode("utf-8", errors="replace").strip())
