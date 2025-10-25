"""End-to-end smoke test exercising the full ContainrLab workflow.

Run with: `python scripts/e2e_smoke.py --lab lab1`.

Steps:
  1. POST /auth/login to obtain a bearer token.
  2. POST /labs/{lab}/start to create a runner session.
  3. Call /agent/hint and /agent/patch to verify the agent path (optional).
  4. Apply the patch via /agent/patch/apply (falls back to a known-good Dockerfile).
  5. Run the judge via /labs/{lab}/check and ensure it passes.
  6. Fetch /sessions/{id}/inspector to confirm timeline metrics.
  7. Stop the session via /sessions/{id}/run/stop and /labs/{lab}/stop (implicit via runnerd stop).

The script exits non-zero if any step fails.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any, Dict, List, Optional

DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_RUNNER_BASE = "http://localhost:8080"


def main() -> int:
    parser = argparse.ArgumentParser(description="End-to-end ContainrLab smoke test")
    parser.add_argument("--lab", default="lab1", help="Lab slug to exercise (default: lab1)")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="FastAPI base URL")
    parser.add_argument("--runner-base", default=DEFAULT_RUNNER_BASE, help="Runnerd base URL")
    parser.add_argument("--email", default="smoke@example.com", help="Email to use for login")
    parser.add_argument("--prompt", default="Please provide a Dockerfile patch that fixes the lab.", help="Prompt sent to the agent patch endpoint")
    args = parser.parse_args()

    api = args.api_base.rstrip("/")
    runner = args.runner_base.rstrip("/")

    print(f"[1/8] Logging in as {args.email} ...")
    login_payload = _post_json(f"{api}/auth/login", {"email": args.email}, timeout=15)
    token = login_payload.get("token")
    if not isinstance(token, str):
        raise SystemExit("Login failed: token missing from response")
    auth_headers = {"Authorization": f"Bearer {token}"}
    print("    token received.")

    print(f"[2/8] Starting lab session for '{args.lab}' ...")
    session_payload = _post_json(f"{api}/labs/{args.lab}/start", {}, headers=auth_headers, timeout=30)
    session_id = session_payload.get("session_id")
    if not isinstance(session_id, str):
        raise SystemExit("Lab start failed: session_id missing")
    runner_container = session_payload.get("runner_container")
    print(f"    session_id = {session_id}, runner_container = {runner_container}")

    print("[3/8] Requesting agent hint ...")
    hint_payload = _post_json(
        f"{api}/agent/hint",
        {"session_id": session_id, "prompt": "What should I fix in this lab?", "lab_slug": args.lab},
        headers=auth_headers,
        timeout=30,
    )
    print(f"    hint source = {hint_payload.get('source')}")

    print("[4/8] Requesting agent patch ...")
    patch_payload = _post_json(
        f"{api}/agent/patch",
        {"session_id": session_id, "prompt": args.prompt, "lab_slug": args.lab},
        headers=auth_headers,
        timeout=60,
    )
    patch_files: List[Dict[str, Any]] = patch_payload.get("files") or []
    if patch_files:
        print(f"    received {len(patch_files)} file(s) from agent (source={patch_payload.get('source')}).")
    else:
        print("    agent returned no files; falling back to a known-good Dockerfile.")
        patch_files = _fallback_patch_files()

    print("[5/8] Applying patch ...")
    apply_payload = _post_json(
        f"{api}/agent/patch/apply",
        {"session_id": session_id, "files": patch_files},
        headers=auth_headers,
        timeout=60,
    )
    applied = apply_payload.get("applied", [])
    print(f"    applied paths: {applied}")

    print("[6/8] Running judge ...")
    judge_payload = _post_json(
        f"{api}/labs/{args.lab}/check",
        {"session_id": session_id},
        headers=auth_headers,
        timeout=120,
    )
    if not judge_payload.get("passed"):
        raise SystemExit(f"Judge failed: {json.dumps(judge_payload, indent=2)}")
    print("    judge passed ✓")

    print("[7/8] Fetching inspector timeline ...")
    inspector_payload = _get_json(f"{api}/sessions/{session_id}/inspector", headers=auth_headers, timeout=30)
    timeline = inspector_payload.get("timeline") or []
    if not timeline:
        raise SystemExit("Inspector timeline missing or empty.")
    latest = timeline[0]
    print(f"    latest attempt #{latest.get('attempt_id')} passed={latest.get('passed')} metrics={latest.get('metrics')}")

    print("[8/8] Stopping session ...")
    _post_json(
        f"{runner}/stop",
        {"session_id": session_id},
        timeout=15,
    )
    print("    session stopped. Smoke test completed successfully.")
    return 0


def _fallback_patch_files() -> List[Dict[str, Any]]:
    """Return a deterministic patch that satisfies lab1 requirements."""
    dockerfile = """\
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "app.py"]
"""
    dockerignore = """\
__pycache__/
*.pyc
venv/
env/
node_modules/
.git/
"""
    return [
        {"path": "/workspace/Dockerfile", "content": dockerfile, "description": "Known-good Dockerfile for lab1"},
        {"path": "/workspace/.dockerignore", "content": dockerignore, "description": "Keep build context slim"},
    ]


def _post_json(url: str, payload: Dict[str, Any], *, headers: Optional[Dict[str, str]] = None, timeout: int = 30) -> Dict[str, Any]:
    request_headers = {"Content-Type": "application/json"}
    if headers:
        request_headers.update(headers)
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=request_headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        reason = exc.read().decode("utf-8")
        raise SystemExit(f"HTTP {exc.code} when POST {url}: {reason}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Failed to POST {url}: {exc}") from exc


def _get_json(url: str, *, headers: Optional[Dict[str, str]] = None, timeout: int = 30) -> Dict[str, Any]:
    request_headers = {"Accept": "application/json"}
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, headers=request_headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        reason = exc.read().decode("utf-8")
        raise SystemExit(f"HTTP {exc.code} when GET {url}: {reason}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Failed to GET {url}: {exc}") from exc


if __name__ == "__main__":
    raise SystemExit(main())
