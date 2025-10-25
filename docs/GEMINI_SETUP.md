# Gemini Configuration & Fallback Modes

ContainrLab integrates with Google Gemini for agent-driven hints, explanations, and patch suggestions. This document explains how to configure a real API key, how fallbacks behave when a key is absent, and how to switch between modes.

## 1. Obtain an API Key

1. Visit the [Google AI Studio](https://aistudio.google.com/) dashboard.
2. Create or select a project and generate an API key for Gemini 1.5 Flash (or a compatible model).
3. Copy the key; you'll use it in one of the configuration options below.

## 2. Provide the Key to the API Container

### Option A – Secrets File (recommended)

1. Create `compose/secrets/GEMINI_API_KEY.txt` if it does not already exist.
2. Paste the API key into the file (no extra whitespace).
3. Ensure the Docker Compose stack has been rebuilt or restarted:
   ```bash
   cd compose
   docker compose up -d --build
   ```

The backend container automatically reads `/run/secrets/gemini_key` thanks to `compose/docker-compose.yml`. No additional environment variables are required.

### Option B – Environment Variable

Set `GEMINI_API_KEY` before starting the API service:

```bash
export GEMINI_API_KEY="sk-..."
cd compose
docker compose up -d --build
```

This method is convenient for temporary local testing but avoid committing the key or storing it in shell history.

### Option C – Direct Environment File

If you operate outside Docker (running the FastAPI app locally), set either:

```bash
export GEMINI_API_KEY="sk-..."
# or
export GEMINI_API_KEY_FILE="/absolute/path/to/key.txt"
```

## 3. Available Environment Tweaks

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_MODEL` | `models/gemini-1.5-flash` | Override the model to use (e.g., `models/gemini-1.5-pro`). |
| `GEMINI_TEMPERATURE` | `0.7` | Controls creativity. Lower values produce more deterministic responses. |
| `GEMINI_MAX_OUTPUT_TOKENS` | `512` | Limits response length. Bump this if you need long explanations or patches. |
| `GEMINI_TIMEOUT_SECONDS` | `20` | HTTP timeout for Gemini requests. |

Set these alongside `GEMINI_API_KEY` if you need custom behaviour.

## 4. Fallback & Stub Mode

When no API key is supplied, or if Gemini returns an error, the agent responds with deterministic stubs:

- Hints and explanations provide short, pre-written guidance.
- Patch requests return a safe example patch covering common Dockerfile fixes (e.g., reordering dependency installs).

This ensures the UI remains usable during development or outages. The fallback behaviour is logged so you can spot when the real API isn't being used.

## 5. Verifying Configuration

After restarting the stack:

1. Check the API logs for messages from `containrlab.agent`. Successful Gemini calls log events such as `Gemini response received`.
2. Use the UI agent drawer:
   - A “Stub” badge indicates fallback responses.
   - “Gemini” indicates live calls are succeeding.
3. Alternatively, call the API directly:

```bash
curl -s -X POST http://localhost:8000/agent/hint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"session_id":"...", "prompt":"Where do I install dependencies?", "lab_slug":"lab1"}'
```

If the `source` field in the response is `"gemini"`, the live integration is working.

## 6. Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `401` response when calling Gemini | Key revoked or incorrect project access | Regenerate the key and update the secret/env var. |
| UI permanently shows stub responses | Missing key or network egress blocked | Provide a key and ensure the container can reach `generativelanguage.googleapis.com`. |
| Slow responses (>20s) | Token limit exceeded or model latency | Increase `GEMINI_TIMEOUT_SECONDS` or reduce prompt size. |
| `429` rate-limit errors | Too many requests per minute | The agent enforces a per-session rate limit; wait a minute or lower assistant usage. |

## 7. Security Notes

- Never commit API keys to Git or share them in screenshots/logs.
- Rotate keys regularly if sharing environments with others.
- For production, store the key in a managed secrets store (e.g., AWS Secrets Manager) and inject it at runtime.

---

With the key configured, the agent features (hint/explain/patch) respond with live Gemini-powered content. If you later remove the key, fallback mode kicks in automatically—handy for offline development.
