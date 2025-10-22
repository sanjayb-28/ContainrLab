# Backend

FastAPI application implementing labs, sessions, terminal proxying, filesystem access, and the AI assistant.

## Gemini Agent Integration

The `/agent/hint` and `/agent/explain` endpoints now call Google Gemini by default. Provide credentials through **one** of the following:

- `GEMINI_API_KEY_FILE` – absolute path to a file that contains the API key (used by Docker Compose via `compose/secrets/GEMINI_API_KEY.txt`).
- `GEMINI_API_KEY` – fallback environment variable for local development.

For production, store the secret in AWS Secrets Manager (e.g. `/containrlab/gemini`) and inject it into the container as a file or environment variable during deploy.

Optional tuning knobs:

- `GEMINI_MODEL` (default: `models/gemini-1.5-flash`)
- `GEMINI_TEMPERATURE` (default: `0.7`)
- `GEMINI_MAX_OUTPUT_TOKENS` (default: `512`)
- `GEMINI_TIMEOUT_SECONDS` (default: `20`)

For local development you can export the variable or create the secret file:

```bash
echo "your-api-key" > compose/secrets/GEMINI_API_KEY.txt
export GEMINI_API_KEY_FILE="$(pwd)/compose/secrets/GEMINI_API_KEY.txt"
```

The agent enforces a lightweight in-process rate limit (5 requests per minute per session). When the key is missing or the API returns an error, the service automatically falls back to deterministic stub guidance so the UI remains usable.
