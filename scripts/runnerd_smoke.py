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
DEFAULT_API_BASE = "http://localhost:8000"


def main() -> int:
    parser = argparse.ArgumentParser(description="Runnerd smoke test")
    parser.add_argument("lab", help="Lab slug to seed", default="lab1", nargs="?")
    parser.add_argument("--base-url", dest="base_url", default=DEFAULT_BASE_URL)
    parser.add_argument("--api-base", dest="api_base", default=None, help="Backend API base URL (enables judge check).")
    parser.add_argument("--skip-build", action="store_true", help="Skip build check")
    parser.add_argument("--skip-run", action="store_true", help="Skip runtime container check")
    parser.add_argument("--skip-judge", action="store_true", help="Skip backend judge request even if API base is provided.")
    args = parser.parse_args()

    api_base = (args.api_base or "").rstrip("/")

    session_id = uuid.uuid4().hex
    container_name = None

    if api_base:
        print(f"Starting session via API for lab '{args.lab}'...")
        api_start = _post(
            f"{api_base or DEFAULT_API_BASE}/labs/{args.lab}/start",
            data={},
            timeout=30,
        )
        print("API start response:")
        print(json.dumps(api_start, indent=2))
        session_id = api_start.get("session_id", session_id)
        container_name = api_start.get("runner_container")
    else:
        print(f"Starting session {session_id} for lab '{args.lab}'...")
        start_body = _post(
            f"{args.base_url}/start",
            data={"session_id": session_id, "lab_slug": args.lab},
            timeout=30,
        )
        print(f"Start response:\n{json.dumps(start_body, indent=2)}")
        container_name = start_body.get("container")

    image_tag = None
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
        image_tag = build_body.get("image_tag")

    if not args.skip_run:
        if not image_tag:
            image_tag = f"smoke-{session_id[:12]}"
        print("Launching runtime container inside the session...")
        run_payload = {
            "session_id": session_id,
            "image": image_tag,
            "command": ["sleep", "20"],
            "detach": True,
            "auto_remove": False,
            "remove_existing": True,
        }
        run_body = _post(f"{args.base_url}/run", data=run_payload, timeout=60)
        print("Run response:")
        print(json.dumps(run_body, indent=2))

        inner_name = run_body.get("container_name") or container_name
        if not isinstance(inner_name, str):
            raise SystemExit("Run response missing container_name")

        print("Stopping runtime container...")
        stop_body = _post(
            f"{args.base_url}/run/stop",
            data={
                "session_id": session_id,
                "container_name": inner_name,
                "timeout": 2,
                "remove": True,
                "ignore_missing": False,
            },
            timeout=30,
        )
        print("Run stop response:")
        print(json.dumps(stop_body, indent=2))

    if api_base:
        try:
            print("Listing workspace via API...")
            listing_body = _get(
                f"{api_base or DEFAULT_API_BASE}/fs/{session_id}/list?path=/workspace",
                timeout=30,
            )
            print(json.dumps(listing_body, indent=2))
        except SystemExit as exc:
            print(exc)

    if api_base and not args.skip_judge:
        print("Invoking backend judge endpoint...")
        judge_body = _post(
            f"{api_base or DEFAULT_API_BASE}/labs/{args.lab}/check",
            data={"session_id": session_id},
            timeout=120,
        )
        print("Judge response:")
        print(json.dumps(judge_body, indent=2))

        try:
            print("Fetching session detail...")
            session_body = _get(
                f"{api_base or DEFAULT_API_BASE}/sessions/{session_id}?limit=5",
                timeout=30,
            )
            print("Session detail response:")
            print(json.dumps(session_body, indent=2))
        except SystemExit as exc:
            print(exc)

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


def _get(url: str, *, timeout: int) -> dict[str, object]:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        raise SystemExit(f"HTTP error {exc.code} for {url}: {body}") from exc


if __name__ == "__main__":
    raise SystemExit(main())
