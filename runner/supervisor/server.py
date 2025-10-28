from __future__ import annotations

import asyncio
import contextlib
import base64
import binascii
import io
import json
import os
import shlex
import tarfile
import time
from pathlib import Path
from typing import Any, Dict, List, Literal

import docker  # type: ignore[import]
from docker.errors import APIError, NotFound  # type: ignore[import]
import logging
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect  # type: ignore[import]
from starlette.websockets import WebSocketState  # type: ignore[import]
from pydantic import BaseModel, Field  # type: ignore[import]

app = FastAPI(title="runnerd")

logger = logging.getLogger("runnerd.terminal")
if not logger.handlers:
    logger.setLevel(logging.INFO)

client = docker.from_env()

RUNNER_IMAGE = os.getenv("RUNNER_IMAGE", "containrlab-runner:latest")
LABS_ROOT = Path(os.getenv("LABS_ROOT", "/labs"))
STARTUP_TIMEOUT = int(os.getenv("STARTUP_TIMEOUT", "30"))
MEMORY_LIMIT = os.getenv("RUNNER_MEMORY", "2g")
NANO_CPUS = int(os.getenv("RUNNER_NANO_CPUS", str(1_000_000_000)))
PIDS_LIMIT = int(os.getenv("RUNNER_PIDS_LIMIT", "1024"))
SOCKET_PATH = os.getenv("RUNNER_SOCKET_PATH", "/var/run/docker.sock")
MAX_LOG_LINES = 200
DEFAULT_SHELL = os.getenv("RUNNER_DEFAULT_SHELL", "/bin/sh")
WORKSPACE_ROOT = "/workspace"
LISTING_SCRIPT = """
import json, os, sys, time
root = sys.argv[1]
entries = []
if os.path.exists(root):
    for name in sorted(os.listdir(root)):
        full = os.path.join(root, name)
        info = {
            "name": name,
            "path": os.path.join(root, name),
            "is_dir": os.path.isdir(full),
            "size": os.path.getsize(full) if os.path.isfile(full) else None,
            "modified": os.path.getmtime(full),
        }
        entries.append(info)
print(json.dumps({"entries": entries, "exists": os.path.exists(root), "is_dir": os.path.isdir(root)}))
"""


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


class FsListRequest(BaseModel):
    session_id: str
    path: str | None = None


class FsReadRequest(BaseModel):
    session_id: str
    path: str


class FsWriteRequest(BaseModel):
    session_id: str
    path: str
    content: str
    encoding: str = "base64"


class FsCreateRequest(BaseModel):
    session_id: str
    path: str
    kind: Literal["file", "directory"] = "file"
    content: str | None = None
    encoding: str = "base64"


class FsRenameRequest(BaseModel):
    session_id: str
    path: str
    new_path: str


class FsDeleteRequest(BaseModel):
    session_id: str
    path: str


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

    metrics = _collect_image_metrics(container, image_tag, elapsed, logs)

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


@app.websocket("/terminal/{session_id}")
async def terminal_websocket(websocket: WebSocket, session_id: str, shell: str = DEFAULT_SHELL):
    await websocket.accept()
    logger.info("terminal websocket accepted %s", session_id)
    try:
        container = _get_running_container(session_id)
        exec_id = container.client.api.exec_create(  # type: ignore[attr-defined]
            container.id,
            cmd=[shell],
            tty=True,
            stdin=True,
            stdout=True,
            stderr=True,
        )
        stream = container.client.api.exec_start(  # type: ignore[attr-defined]
            exec_id,
            tty=True,
            stream=False,
            socket=True,
        )
        sock = stream
        raw_sock = getattr(sock, "_sock", sock)
        # Set socket timeout to prevent blocking recv calls
        raw_sock.settimeout(5.0)
        loop = asyncio.get_event_loop()
        stop_event = asyncio.Event()

        async def pump_container_to_client() -> None:
            try:
                last_ping = time.time()
                while not stop_event.is_set():
                    try:
                        data = await loop.run_in_executor(None, raw_sock.recv, 4096)
                    except (TimeoutError, OSError):
                        # Send keepalive ping every 30 seconds to prevent ALB timeout
                        if time.time() - last_ping > 30:
                            try:
                                await websocket.send_json({"type": "ping"})
                                last_ping = time.time()
                            except Exception:
                                break
                        continue
                    if not data:
                        logger.debug("terminal socket closed session=%s", session_id)
                        break
                    await websocket.send_text(data.decode("utf-8", errors="ignore"))
                    last_ping = time.time()  # Reset ping timer on activity
            except Exception as exc:
                logger.exception("container->client error %s", session_id, exc_info=exc)
            finally:
                stop_event.set()

        async def pump_client_to_container() -> None:
            try:
                while not stop_event.is_set():
                    try:
                        message = await websocket.receive_text()
                    except WebSocketDisconnect:
                        logger.info("frontend disconnected %s", session_id)
                        break
                    except Exception as exc:
                        logger.exception("receive error %s", session_id, exc_info=exc)
                        break
                    try:
                        payload = json.loads(message)
                        # Ensure payload is a dict (json.loads can return int/str/list)
                        if not isinstance(payload, dict):
                            payload = {"type": "input", "data": message}
                    except json.JSONDecodeError:
                        payload = {"type": "input", "data": message}

                    msg_type = payload.get("type")
                    logger.debug("terminal inbound session=%s type=%s", session_id, msg_type)
                    if msg_type == "input":
                        data = payload.get("data", "")
                        if isinstance(data, str) and data:
                            await loop.run_in_executor(None, raw_sock.sendall, data.encode("utf-8"))
                    elif msg_type == "pong":
                        # Ignore pong responses to our ping keepalives
                        continue
                    elif msg_type == "resize":
                        cols = payload.get("cols")
                        rows = payload.get("rows")
                        if isinstance(cols, int) and isinstance(rows, int):
                            try:
                                logger.debug("terminal resize session=%s cols=%s rows=%s", session_id, cols, rows)
                                container.client.api.exec_resize(  # type: ignore[attr-defined]
                                    exec_id,
                                    width=cols,
                                    height=rows,
                                )
                            except APIError as exc:
                                logger.warning("resize failed %s: %s", session_id, exc)
            finally:
                stop_event.set()
        try:
            await asyncio.gather(pump_container_to_client(), pump_client_to_container())
        finally:
            stop_event.set()
            try:
                try:
                    raw_sock.close()
                finally:
                    if sock is not raw_sock:
                        with contextlib.suppress(Exception):
                            sock.close()
            except Exception:
                pass
            if websocket.application_state is not WebSocketState.DISCONNECTED:
                with contextlib.suppress(Exception):
                    await websocket.close()
    except Exception as exc:
        logger.exception("terminal websocket failure %s", session_id, exc_info=exc)
        if websocket.application_state is not WebSocketState.DISCONNECTED:
            with contextlib.suppress(Exception):
                await websocket.close(code=1011, reason=str(exc))


@app.post("/fs/list")
def list_path(payload: FsListRequest) -> Dict[str, Any]:
    container = _get_running_container(payload.session_id)
    target = _sanitize_workspace_path(payload.path or WORKSPACE_ROOT)
    command = [
        "python3",
        "-c",
        LISTING_SCRIPT,
        target,
    ]
    logs, exit_code, _ = _exec_container_command(container, command)
    if exit_code != 0:
        raise HTTPException(status_code=500, detail="Failed to list directory")
    try:
        listing = json.loads("\n".join(logs))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Invalid listing payload") from exc
    if not listing.get("exists"):
        raise HTTPException(status_code=404, detail="Path not found")
    listing["path"] = target
    return listing


@app.post("/fs/read")
def read_file(payload: FsReadRequest) -> Dict[str, Any]:
    container = _get_running_container(payload.session_id)
    target = _sanitize_workspace_path(payload.path)
    try:
        stream, stat = container.get_archive(target)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail="File not found") from exc
    except APIError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {exc.explanation}") from exc

    data = io.BytesIO()
    for chunk in stream:
        data.write(chunk)
    data.seek(0)
    with tarfile.open(fileobj=data, mode="r:") as tar:
        member = tar.next()
        if member is None or not member.isfile():
            raise HTTPException(status_code=400, detail="Target is not a regular file")
        extracted = tar.extractfile(member)
        if extracted is None:
            raise HTTPException(status_code=500, detail="Failed to extract file content")
        content_bytes = extracted.read()
    return {
        "path": target,
        "encoding": "base64",
        "content": base64.b64encode(content_bytes).decode("ascii"),
    }


@app.post("/fs/write")
def write_file(payload: FsWriteRequest) -> Dict[str, Any]:
    if payload.encoding != "base64":
        raise HTTPException(status_code=400, detail="Only base64 encoding is supported")
    try:
        raw_bytes = base64.b64decode(payload.content)
    except (ValueError, binascii.Error) as exc:  # type: ignore[name-defined]
        raise HTTPException(status_code=400, detail="Invalid base64 payload") from exc

    container = _get_running_container(payload.session_id)
    target = _sanitize_workspace_path(payload.path)
    _write_bytes(container, target, raw_bytes)
    return {"ok": True, "path": target}


@app.post("/fs/create")
def create_entry(payload: FsCreateRequest) -> Dict[str, Any]:
    container = _get_running_container(payload.session_id)
    target = _sanitize_workspace_path(payload.path)

    if payload.kind == "directory":
        mkdir_cmd = ["sh", "-c", f"mkdir -p {shlex.quote(target)}"]
        result = container.exec_run(mkdir_cmd)
        if result.exit_code not in (0, None):
            raise HTTPException(status_code=500, detail="Failed to create directory")
        return {"ok": True, "path": target, "kind": "directory"}

    if payload.encoding != "base64":
        raise HTTPException(status_code=400, detail="Only base64 encoding is supported")
    try:
        raw_bytes = base64.b64decode(payload.content or "")
    except (ValueError, binascii.Error) as exc:  # type: ignore[name-defined]
        raise HTTPException(status_code=400, detail="Invalid base64 payload") from exc

    _write_bytes(container, target, raw_bytes)
    return {"ok": True, "path": target, "kind": "file"}


@app.post("/fs/rename")
def rename_entry(payload: FsRenameRequest) -> Dict[str, Any]:
    container = _get_running_container(payload.session_id)
    source = _sanitize_workspace_path(payload.path)
    destination = _sanitize_workspace_path(payload.new_path)

    if source == destination:
        raise HTTPException(status_code=400, detail="Source and destination paths are identical")

    exists = container.exec_run(["test", "-e", source])
    if exists.exit_code not in (0, None):
        raise HTTPException(status_code=404, detail="Source path not found")

    dest_parent = os.path.dirname(destination) or WORKSPACE_ROOT
    parent_result = container.exec_run(["sh", "-c", f"mkdir -p {shlex.quote(dest_parent)}"])
    if parent_result.exit_code not in (0, None):
        raise HTTPException(status_code=500, detail="Failed to prepare destination directory")

    result = container.exec_run(["sh", "-c", f"mv {shlex.quote(source)} {shlex.quote(destination)}"])
    if result.exit_code not in (0, None):
        raise HTTPException(status_code=500, detail="Failed to rename path")

    return {"ok": True, "path": source, "new_path": destination}


@app.post("/fs/delete")
def delete_entry(payload: FsDeleteRequest) -> Dict[str, Any]:
    container = _get_running_container(payload.session_id)
    target = _sanitize_workspace_path(payload.path)

    if target == WORKSPACE_ROOT:
        raise HTTPException(status_code=400, detail="Cannot delete workspace root")

    exists = container.exec_run(["test", "-e", target])
    if exists.exit_code not in (0, None):
        raise HTTPException(status_code=404, detail="Path not found")

    command = ["sh", "-c", f"rm -rf {shlex.quote(target)}"]
    result = container.exec_run(command)
    if result.exit_code not in (0, None):
        raise HTTPException(status_code=500, detail="Failed to delete path")

    return {"ok": True, "path": target}


def _write_bytes(container, target: str, raw_bytes: bytes) -> None:
    directory = os.path.dirname(target) or WORKSPACE_ROOT

    mkdir_cmd = ["sh", "-c", f"mkdir -p {shlex.quote(directory)}"]
    result = container.exec_run(mkdir_cmd)
    if result.exit_code not in (0, None):
        raise HTTPException(status_code=500, detail="Failed to prepare directory")

    tarstream = io.BytesIO()
    with tarfile.open(fileobj=tarstream, mode="w") as tar:
        info = tarfile.TarInfo(name=os.path.basename(target))
        info.size = len(raw_bytes)
        info.mtime = int(time.time())
        tar.addfile(info, io.BytesIO(raw_bytes))
    tarstream.seek(0)
    success = container.put_archive(directory, tarstream.getvalue())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to write file")


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
        container.reload()
        if container.status != "running":
            logs = container.logs(tail=50).decode("utf-8", errors="ignore")
            container.remove(force=True)
            raise HTTPException(
                status_code=502,
                detail=f"Runner container exited during startup: status={container.status}, logs:\n{logs}",
            )
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


def _collect_image_metrics(container, image_tag: str, elapsed: float, build_logs: List[str]) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {"elapsed_seconds": round(elapsed, 3)}

    cache_hits = sum(1 for line in build_logs if "CACHED" in line.upper())
    if cache_hits:
        metrics["cache_hits"] = cache_hits

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

    layers_result = container.exec_run(["docker", "history", image_tag, "--format", "{{.ID}}|{{.Size}}|{{.CreatedBy}}" ])  # type: ignore[list-item]
    if layers_result.exit_code == 0:
        entries_raw = [line for line in layers_result.output.decode("utf-8", errors="replace").splitlines() if line.strip()]
        metrics["layer_count"] = len(entries_raw)
        layers: List[Dict[str, Any]] = []
        for item in entries_raw:
            parts = item.split("|", maxsplit=2)
            layer_id = parts[0]
            size_str = parts[1] if len(parts) > 1 else ""
            command = parts[2] if len(parts) > 2 else ""
            layer: Dict[str, Any] = {"id": layer_id}
            try:
                size_bytes = int(size_str)
            except ValueError:
                size_bytes = None
            if size_bytes is not None:
                layer["size_bytes"] = size_bytes
                layer["size_mb"] = round(size_bytes / (1024 * 1024), 2)
            if command:
                layer["created_by"] = command.strip()[:160]
            layers.append(layer)
        if layers:
            metrics["layers"] = layers

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


def _sanitize_workspace_path(path: str) -> str:
    raw = path or WORKSPACE_ROOT
    if raw.startswith("/"):
        normalized = os.path.normpath(raw)
    else:
        normalized = os.path.normpath(os.path.join(WORKSPACE_ROOT, raw))
    if not normalized.startswith(WORKSPACE_ROOT):
        raise HTTPException(status_code=400, detail="Path escapes workspace root")
    if normalized == "/":
        return WORKSPACE_ROOT
    return normalized
