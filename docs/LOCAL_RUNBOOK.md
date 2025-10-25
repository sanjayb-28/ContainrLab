# ContainrLab Local Runbook

This guide walks through standing up the full ContainrLab stack on a single development machine, signing in, and validating the end-to-end experience.

## Prerequisites

- macOS or Linux with Docker Desktop (or Docker Engine) installed.
- Python 3.11+ (for the smoke script).
- Node.js 20+ (only required if you plan to run the frontend outside Docker).

> **Tip:** The repository already bundles a Docker Compose stack under `compose/`. You do *not* need to install Redis, FastAPI, or Next.js on the host.

## First-Time Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ContainrLab/ContainrLab.git
   cd ContainrLab
   ```

2. **Provide a Gemini API key (optional but recommended)**
   - Follow the instructions in [`docs/GEMINI_SETUP.md`](./GEMINI_SETUP.md) to place your key in `compose/secrets/GEMINI_API_KEY.txt` or export `GEMINI_API_KEY`.
   - Without a key the agent will fall back to deterministic stub responses. The UI will still function, including patch suggestions, thanks to the built-in fallback.

3. **Bring the stack online**
   ```bash
   cd compose
   docker compose up --build
   ```
   The first build can take several minutes while Docker images are created. Subsequent runs are much faster.

4. **Wait for services to report healthy**
   - API: `http://localhost:8000/healthz`
   - Runnerd: `http://localhost:8080/healthz`
   - Frontend: http://localhost:3000

## Authentication Flow

ContainrLab uses a lightweight token-based login during the MVP phase:

1. Open http://localhost:3000 in a browser.
2. Enter your email in the “Sign in to start labs” box (any address is accepted locally).
3. The frontend calls `POST /auth/login`. The API returns a JSON payload containing `token`. The UI automatically stores it in `localStorage` and attaches it to subsequent requests.
4. The signed-in banner shows your user ID. You can sign out via the “Log out” button, which simply removes the token from storage.

If you prefer the CLI, you can call:

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com"}'
```

Then export the token for subsequent API calls:

```bash
export CONTAINRLAB_TOKEN="<token from login response>"
curl -H "Authorization: Bearer $CONTAINRLAB_TOKEN" http://localhost:8000/labs
```

## Running the End-to-End Smoke Test

The scripted smoke test exercises the happy path:

1. Logs in with a disposable email and captures the token.
2. Starts a lab session.
3. Requests an agent patch and applies it (falls back to a known-good solution if the agent stub returns empty).
4. Runs the judge to ensure the lab passes.
5. Fetches inspector metrics/timeline for verification.
6. Stops the session and reports success/failure.

Run it from the repository root while Docker Compose is up:

```bash
python scripts/e2e_smoke.py --lab lab1
```

Use `--api-base` and `--runner-base` to target non-default hosts:

```bash
python scripts/e2e_smoke.py --lab lab2 \
  --api-base http://localhost:8000 \
  --runner-base http://localhost:8080
```

The script exits with a non-zero status if any step fails, making it safe to integrate into CI once the MVP graduates to automated testing.

## Manual Verification Checklist

- [ ] Login succeeds and the token banner appears.
- [ ] Starting a lab session creates a new workspace and opens the terminal/editor/inspector panes.
- [ ] File edits autosave and can trigger a build-on-save if enabled.
- [ ] Agent hints/explanations respond with either Gemini output or the deterministic fallback.
- [ ] Agent patch suggestions can be applied via the UI and reflected in the editor.
- [ ] The judge passes once the Dockerfile is corrected.
- [ ] Inspector timeline shows each attempt with metrics deltas.

## Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `401 Unauthorized` from API | Missing/expired bearer token | Re-login or export the token via `curl`. |
| Agent requests always return stub responses | Missing `GEMINI_API_KEY` | Follow [`docs/GEMINI_SETUP.md`](./GEMINI_SETUP.md). |
| Labs page reports “Unable to reach the ContainrLab API” or logs JSON parse errors | `NEXT_PUBLIC_API_BASE` pointing at a non-local host or the API container is down | Ensure the API container is healthy and rebuild the stack; override `NEXT_PUBLIC_API_BASE` if you need a different host. |
| Browser console shows `CORS error` for `/auth/login` | Compose stack missing updated API image with CORS support | Rebuild the API container (`docker compose build api && docker compose up`) or set `CORS_ALLOW_ORIGINS` to include your frontend origin. |
| `Failed to persist user ... token_hash` during login | Old SQLite schema missing new auth columns | Rebuild/restart the API container so it applies the automatic column backfill; if the error persists, remove `sqlite/app.db` (it will be recreated on startup). |
| Docker builds fail inside runner | Outdated lab solution or missing dependencies | Apply the agent patch or edit the Dockerfile manually, then rerun the judge. |
| `docker compose up` hangs on runnerd | Host Docker daemon not sharing `/var/run/docker.sock` | Ensure Docker Desktop is running and restart the compose stack. |

## Stopping the Stack

Press `Ctrl+C` in the compose terminal or run:

```bash
cd compose
docker compose down
```

The SQLite database under `sqlite/app.db` and lab workspaces persist across restarts so you can resume sessions later if needed.

---

Need deeper Gemini configuration details? Head over to [`docs/GEMINI_SETUP.md`](./GEMINI_SETUP.md). For historical changes or future roadmap, consult `docs/roadmap.txt`.
