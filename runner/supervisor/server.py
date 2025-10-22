from __future__ import annotations

import io
import os
import tarfile
import time
from pathlib import Path

import docker  # type: ignore[import]
from docker.errors import APIError, NotFound  # type: ignore[import]
from fastapi import FastAPI, HTTPException  # type: ignore[import]
from pydantic import BaseModel  # type: ignore[import]

app = FastAPI(title="runnerd")

client = docker.from_env()

RUNNER_IMAGE = os.getenv("RUNNER_IMAGE", "containrlab-runner:latest")
LABS_ROOT = Path(os.getenv("LABS_ROOT", "/labs"))
STARTUP_TIMEOUT = int(os.getenv("STARTUP_TIMEOUT", "30"))
MEMORY_LIMIT = os.getenv("RUNNER_MEMORY", "2g")
NANO_CPUS = int(os.getenv("RUNNER_NANO_CPUS", str(1_000_000_000)))
PIDS_LIMIT = int(os.getenv("RUNNER_PIDS_LIMIT", "1024"))
SOCKET_PATH = os.getenv("RUNNER_SOCKET_PATH", "/var/run/docker.sock")


class StartRequest(BaseModel):
    session_id: str
    lab_slug: str


class StopRequest(BaseModel):
    session_id: str
    preserve_workspace: bool = False


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
