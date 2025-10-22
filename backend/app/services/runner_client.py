from __future__ import annotations

import os
from typing import Any

import httpx  # type: ignore[import]

RUNNERD_BASE_URL = os.getenv("RUNNERD_BASE_URL", "http://runnerd:8080")


class RunnerClient:
    """Thin wrapper around runnerd's HTTP API.

    Uses a short-lived httpx.AsyncClient per call; MVP keeps things simple.
    """

    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = (base_url or RUNNERD_BASE_URL).rstrip("/")

    async def health(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{self._base_url}/healthz")
            response.raise_for_status()
            return response.json()

    async def start(self, session_id: str, lab_slug: str) -> dict[str, Any]:
        payload = {"session_id": session_id, "lab_slug": lab_slug}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{self._base_url}/start", json=payload)
            response.raise_for_status()
            return response.json()

    async def stop(self, session_id: str, preserve_workspace: bool = False) -> dict[str, Any]:
        payload = {"session_id": session_id, "preserve_workspace": preserve_workspace}
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{self._base_url}/stop", json=payload)
            response.raise_for_status()
            return response.json()

    async def build(
        self,
        session_id: str,
        *,
        context_path: str = "/workspace",
        dockerfile_path: str = "Dockerfile",
        image_tag: str | None = None,
        build_args: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        payload = {
            "session_id": session_id,
            "context_path": context_path,
            "dockerfile_path": dockerfile_path,
            "image_tag": image_tag,
            "build_args": build_args or {},
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{self._base_url}/build", json=payload)
            response.raise_for_status()
            return response.json()

    async def run(
        self,
        session_id: str,
        *,
        image: str,
        command: list[str] | None = None,
        env: dict[str, str] | None = None,
        ports: list[str] | None = None,
        name: str | None = None,
        detach: bool = True,
        auto_remove: bool = False,
        remove_existing: bool = True,
    ) -> dict[str, Any]:
        payload = {
            "session_id": session_id,
            "image": image,
            "command": command or [],
            "env": env or {},
            "ports": ports or [],
            "name": name,
            "detach": detach,
            "auto_remove": auto_remove,
            "remove_existing": remove_existing,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{self._base_url}/run", json=payload)
            response.raise_for_status()
            return response.json()

    async def exec(
        self,
        session_id: str,
        *,
        command: list[str],
        workdir: str | None = None,
        environment: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        payload = {
            "session_id": session_id,
            "command": command,
            "workdir": workdir,
            "environment": environment or {},
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{self._base_url}/exec", json=payload)
            response.raise_for_status()
            return response.json()

    async def stop_run(
        self,
        session_id: str,
        *,
        container_name: str | None = None,
        timeout: int = 10,
        remove: bool = True,
        ignore_missing: bool = True,
    ) -> dict[str, Any]:
        payload = {
            "session_id": session_id,
            "container_name": container_name,
            "timeout": timeout,
            "remove": remove,
            "ignore_missing": ignore_missing,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(f"{self._base_url}/run/stop", json=payload)
            response.raise_for_status()
            return response.json()


def get_runner_client() -> RunnerClient:
    """Convenience dependency for FastAPI injection."""
    return RunnerClient()
