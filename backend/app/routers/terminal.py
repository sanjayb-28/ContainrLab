from __future__ import annotations

import asyncio
import contextlib
from urllib.parse import urlencode, urlparse, urlunparse

import httpx  # type: ignore[import]
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.auth_service import hash_token
from ..services.runner_client import RUNNERD_BASE_URL
from ..services.storage import StorageError, get_storage

router = APIRouter()


def _build_runner_ws_url(session_id: str, shell: str, base_url: str | None = None) -> str:
    base = (base_url or RUNNERD_BASE_URL).rstrip("/")
    normalized = base if "://" in base else f"http://{base}"
    parsed = urlparse(normalized)
    scheme = "ws"
    if parsed.scheme == "https":
        scheme = "wss"
    netloc = parsed.netloc or parsed.path
    path_base = parsed.path.rstrip("/")
    path = (path_base + f"/terminal/{session_id}") if path_base else f"/terminal/{session_id}"
    query = urlencode({"shell": shell})
    return urlunparse((scheme, netloc, path, "", query, ""))


@router.websocket("/ws/terminal/{session_id}")
async def terminal_proxy(websocket: WebSocket, session_id: str, shell: str = "/bin/sh", token: str | None = None) -> None:
    await websocket.accept()
    storage = get_storage()
    if not token:
        await websocket.close(code=4401, reason="Missing auth token")
        return
    user = storage.get_user_by_token_hash(hash_token(token))
    if user is None:
        await websocket.close(code=4403, reason="Invalid auth token")
        return
    try:
        storage.assert_session_owner(session_id, user["user_id"])
    except StorageError as exc:
        message = str(exc)
        code = 4404 if "not found" in message else 4403
        await websocket.close(code=code, reason=message)
        return
    runner_url = _build_runner_ws_url(session_id, shell)

    async with httpx.AsyncClient(timeout=None) as client:
        try:
            async with client.ws_connect(runner_url) as runner_ws:
                async def backend_to_runner() -> None:
                    try:
                        while True:
                            message = await websocket.receive_text()
                            await runner_ws.send_text(message)
                    except WebSocketDisconnect:
                        await runner_ws.aclose()
                    except Exception:
                        await runner_ws.aclose()

                async def runner_to_backend() -> None:
                    async for message in runner_ws.iter_text():
                        await websocket.send_text(message)

                await asyncio.gather(backend_to_runner(), runner_to_backend())
        except (httpx.WebSocketReadError, httpx.ConnectError) as exc:
            await websocket.close(code=1011, reason=f"Runner terminal unavailable: {exc}")
        except WebSocketDisconnect:
            pass
        finally:
            with contextlib.suppress(Exception):
                await websocket.close()
