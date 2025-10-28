import asyncio
import contextlib
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx  # type: ignore[import]
from fastapi import FastAPI, HTTPException  # type: ignore[import]
from fastapi.middleware.cors import CORSMiddleware  # type: ignore[import]

from .routers import agent, auth, files, labs, sessions, terminal
from .services.storage import get_storage
from .services.runner_client import get_runner_client

app = FastAPI(title="DockrLearn API")

RUNNERD_BASE_URL = os.getenv("RUNNERD_BASE_URL", "http://runnerd:8080")
SESSION_CLEANUP_INTERVAL_SECONDS = float(os.getenv("SESSION_CLEANUP_INTERVAL_SECONDS", "60"))
SESSION_TTL_GRACE_SECONDS = int(os.getenv("SESSION_TTL_GRACE_SECONDS", "120"))

DEFAULT_CORS_ORIGINS = {"http://localhost:3000", "http://127.0.0.1:3000"}
extra_origins = {
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
    if origin.strip()
}
ALLOW_ORIGINS = sorted(DEFAULT_CORS_ORIGINS | extra_origins)

logger = logging.getLogger("containrlab.session_cleanup")
_cleanup_task: asyncio.Task[None] | None = None

# CORS middleware must be added BEFORE routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(labs.router)
app.include_router(sessions.router)
app.include_router(files.router)
app.include_router(terminal.router)
app.include_router(agent.router)
app.include_router(auth.router)


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    """Health probe for the compose stack."""
    return {"ok": True}


@app.get("/runnerd/healthz")
async def runnerd_healthz() -> dict:
    """Proxy the runnerd health endpoint so we can alert if it degrades."""
    url = f"{RUNNERD_BASE_URL.rstrip('/')}/healthz"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as exc:  # pragma: no cover - trivial passthrough
        raise HTTPException(status_code=502, detail=f"runnerd health check failed: {exc}") from exc
    return response.json()


@app.on_event("startup")
async def _startup() -> None:
    get_storage()
    _start_session_cleanup()


@app.on_event("shutdown")
async def _shutdown() -> None:
    await _stop_session_cleanup()


def _start_session_cleanup() -> None:
    global _cleanup_task
    if _cleanup_task is not None:
        return
    loop = asyncio.get_event_loop()
    _cleanup_task = loop.create_task(_session_cleanup_loop())


async def _stop_session_cleanup() -> None:
    global _cleanup_task
    if _cleanup_task is None:
        return
    _cleanup_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await _cleanup_task
    _cleanup_task = None


async def _session_cleanup_loop() -> None:
    interval = max(1.0, SESSION_CLEANUP_INTERVAL_SECONDS)
    try:
        while True:
            await _perform_session_cleanup()
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        raise
    except Exception:  # pragma: no cover - defensive guard
        logger.exception("Unexpected error in session cleanup loop")


async def _perform_session_cleanup() -> None:
    storage = get_storage()
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=max(0, SESSION_TTL_GRACE_SECONDS))
    expired_sessions = storage.list_expired_sessions(before=cutoff)
    if not expired_sessions:
        return

    runner = get_runner_client()
    for entry in expired_sessions:
        session_id = entry["session_id"]
        mark_ended = False
        try:
            await runner.stop(session_id=session_id, preserve_workspace=False)
            mark_ended = True
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in {404, 409, 410}:
                mark_ended = True
            logger.warning("Failed to stop expired session %s (status %s): %s", session_id, status, exc)
        except httpx.HTTPError as exc:
            logger.warning("Failed to contact runner for expired session %s: %s", session_id, exc)
        else:
            logger.info("Stopped expired session %s", session_id)
        if mark_ended:
            storage.mark_session_ended(session_id=session_id)
