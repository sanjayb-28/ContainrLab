from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient  # type: ignore[import]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.main import app

client = TestClient(app)


def test_hint_endpoint_returns_stub() -> None:
    response = client.post(
        "/agent/hint",
        json={"session_id": "abc", "prompt": "Need a hint"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"]
    assert payload["session_id"] == "abc"


def test_explain_endpoint_rejects_empty_prompt() -> None:
    response = client.post(
        "/agent/explain",
        json={"session_id": "abc", "prompt": "   "},
    )
    assert response.status_code == 400
