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


def get_runner_client() -> RunnerClient:
    """Convenience dependency for FastAPI injection."""
    return RunnerClient()
