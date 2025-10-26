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
   - The stack now targets `models/gemini-flash-latest` by default. If your API key does not have access to that model, override it by setting `GEMINI_MODEL` before running `docker compose up`.

3. **Configure GitHub OAuth credentials for the frontend**
   - Copy `frontend/.env.local.example` to `frontend/.env.local` and fill in the following keys:
     ```bash
     GITHUB_CLIENT_ID=<GitHub OAuth client ID>
     GITHUB_CLIENT_SECRET=<GitHub OAuth client secret>
     NEXTAUTH_SECRET=<any random 32+ character string>
     NEXTAUTH_URL=http://localhost:3000
     ```
   - These values are required for the “Continue with GitHub” login button to work locally. The `NEXTAUTH_SECRET` can be generated with `openssl rand -hex 32`.
   - When running via Docker Compose, export the same variables in your shell **before** `docker compose up` (or create a `compose/.env` file) so the `web` container receives them.

4. **Bring the stack online**
   ```bash
   cd compose
   docker compose up --build
   ```
   The first build can take several minutes while Docker images are created. Subsequent runs are much faster.

5. **Wait for services to report healthy**
   - API: `http://localhost:8000/healthz`
   - Runnerd: `http://localhost:8080/healthz`
   - Frontend: http://localhost:3000

## Authentication Flow

ContainrLab now relies on GitHub OAuth through NextAuth:

1. Visit http://localhost:3000 and click **Continue with GitHub**.
2. Authorise the GitHub application you created earlier. GitHub redirects you back to ContainrLab.
3. On return, the frontend exchanges your GitHub email for a ContainrLab API token via the `/auth/login` endpoint and stores it in the NextAuth session.
4. The signed-in banner shows your ContainrLab user ID. Choose **Log out** to end the session (which clears the NextAuth cookie).

### CLI and automation access

The `/auth/login` endpoint remains available for scripts. Obtain a token and use it in the `Authorization` header:

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com"}' \
  | jq -r '.token'
```

```bash
export CONTAINRLAB_TOKEN="<token>"
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

- [ ] GitHub login succeeds and the signed-in banner appears.
- [ ] Starting a lab session creates a new workspace and opens the terminal/editor/inspector panes.
- [ ] Navigating away (or logging out and back in) restores the same active session instead of creating a fresh one.
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
| GitHub login redirects back with an error | Missing/incorrect `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, or callback URL | Double-check the OAuth app configuration and the values in `frontend/.env.local`. |
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
