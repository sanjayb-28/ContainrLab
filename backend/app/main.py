from fastapi import FastAPI  # type: ignore[import]

app = FastAPI(title="DockrLearn API")


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    """Health probe for the compose stack."""
    return {"ok": True}
