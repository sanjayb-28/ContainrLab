"""Local smoke test for runnerd start/stop endpoints.

Run with: `python scripts/runnerd_smoke.py` while docker compose stack is up.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
import uuid

DEFAULT_BASE_URL = "http://localhost:8080"


def main() -> int:
    parser = argparse.ArgumentParser(description="Runnerd smoke test")
    parser.add_argument("lab", help="Lab slug to seed", default="lab1", nargs="?")
    parser.add_argument("--base-url", dest="base_url", default=DEFAULT_BASE_URL)
    parser.add_argument("--skip-build", action="store_true", help="Skip build check")
    args = parser.parse_args()

    session_id = uuid.uuid4().hex

    print(f"Starting session {session_id} for lab '{args.lab}'...")
    start_body = _post(
        f"{args.base_url}/start",
        data={"session_id": session_id, "lab_slug": args.lab},
        timeout=30,
    )
    print(f"Start response:\n{json.dumps(start_body, indent=2)}")

    if not args.skip_build:
        print("Triggering docker build inside the session...")
        build_payload = {
            "session_id": session_id,
            "context_path": "/workspace",
            "dockerfile_path": "Dockerfile",
            "image_tag": f"smoke-{session_id[:12]}",
        }
        build_body = _post(f"{args.base_url}/build", data=build_payload, timeout=120)
        print("Build response:")
        print(json.dumps(build_body, indent=2))

    try:
        stop_body = _post(
            f"{args.base_url}/stop",
            data={"session_id": session_id},
            timeout=10,
        )
        print("Stop response:")
        print(json.dumps(stop_body, indent=2))
    finally:
        print("Done.")

    return 0


def _post(url: str, *, data: dict[str, object], timeout: int) -> dict[str, object]:
    encoded = json.dumps(data).encode("utf-8")
    request = urllib.request.Request(url, data=encoded, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        raise SystemExit(f"HTTP error {exc.code} for {url}: {body}") from exc


if __name__ == "__main__":
    raise SystemExit(main())
