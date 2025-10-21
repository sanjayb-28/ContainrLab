import os

import httpx
from fastapi import FastAPI, HTTPException  # type: ignore[import]

app = FastAPI(title="DockrLearn API")

RUNNERD_BASE_URL = os.getenv("RUNNERD_BASE_URL", "http://runnerd:8080")


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
