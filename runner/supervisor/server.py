from fastapi import FastAPI  # type: ignore[import]

app = FastAPI(title="runnerd")


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    """Signal to the API layer that runnerd is reachable."""
    return {"ok": True}
