# ContainrLab – Session Kickoff Snapshot

_Last updated: 2025-10-22_

This local-only note exists so a fresh GPT-5 Codex chat can resume work quickly. **Do not commit this file** (ignored via `.gitignore`). `plan.txt` covers the long-term roadmap, and `roadmap.txt` (also ignored) logs chronological milestones. This snapshot explains the current implementation, workflow expectations, and active next steps.

## Workflow Expectations

1. **Create an issue before coding.** Every feature/bugfix should map to a GitHub issue; reference it in PR descriptions to auto-close.
2. **Branch per task.** From `main`: `git checkout -b feature/<short-name>` (or `chore/…`, `fix/…`). Pull latest `main` first.
3. **Commit discipline.** Small, focused commits with descriptive messages referencing issue context when useful.
4. **Testing routine:**
   - Backend: `cd backend && pytest`
   - Frontend: `cd frontend && npm run lint && npm run build`
   - Integration: `python scripts/runnerd_smoke.py lab1 --api-base http://localhost:8000`
5. **Roadmap updates.** After notable work, append concise summary bullets to `roadmap.txt` (remains untracked) and mention the issue/branch.
6. **Security hygiene.** Never allow arbitrary path traversal (runnerd already sanitizes) or shell injection. Validate inputs in new endpoints.
7. **Snapshot maintenance.** Update this file when architecture/major workflows change, but keep it out of git.

## Current Architecture Snapshot

### Backend (FastAPI)
- **Sessions:** `/labs/{slug}/start` seeds runner containers; `/sessions/{id}/build|run|stop` control builds and runtime.
- **Session persistence:** `/labs/{slug}/session` restores the latest active session per user; starting a lab stops any existing session for that lab to keep one workspace alive at a time.
- **Filesystem:** `/fs/{session}/list|read|write|create|rename|delete` forward to runnerd with workspace sandboxing.
- **Inspector:** `/sessions/{id}/inspector` surfaces latest attempt metrics, layer list, cache hits, and delta versus the previous attempt.
- **Terminal:** `/ws/terminal/{session}` upgrades to websocket for interactive shells.
- **Agent:** `/agent/hint` and `/agent/explain` invoke Gemini (Flash 1.5) with safe templates, rate limiting, and logging; fallback responses keep UX usable on error.

### Runnerd (FastAPI + docker-py)
- Manages session containers (Dind), enforcing CPU/memory/PID quotas.
- Exposes `/start`, `/stop`, `/build`, `/run`, `/exec`, `/terminal/{session}`, `/fs/list|read|write|create|rename|delete`.
- Collects build metrics (elapsed seconds, image size, cache hits, layer metadata) for the inspector API.
- Cleans/seed workspace from `labs/<slug>/starter` and prevents escaping `/workspace`.

### Frontend (Next.js App Router + Tailwind)
- Labs list and lab detail pages fetch via REST helpers with error handling.
- **WorkspacePane** renders a nested explorer with create/rename/delete and wires Monaco editor via `/fs` APIs.
- **Terminal** (xterm.js) streams shell I/O through the websocket proxy.
- **InspectorPanel** displays build metrics, deltas versus previous attempt, and layer summaries.
- **AgentDrawer** keeps a request history, supports cancel/resend, and surfaces Gemini responses or fallbacks.
- README viewer renders Markdown (GFM + syntax highlighting).

## Commands Cheat Sheet
```bash
# Frontend lint / build
cd frontend && npm run lint && npm run build

# Backend tests
cd backend && pytest

# Runner smoke (start/build/run/judge/list files)
python scripts/runnerd_smoke.py lab1 --api-base http://localhost:8000

# End-to-end smoke (login, patch apply, judge)
python scripts/e2e_smoke.py --lab lab1

# Launch full stack
cd compose && docker compose up -d
```

## Active / Upcoming Focus
- Session TTL enforcement, idle shutdown, and warning UX.
- Lightweight authentication via GitHub OAuth (NextAuth) to associate sessions with users.
- Agent patch suggestion workflow and apply-in-editor tooling.
- Inspector visual diffing, timeline view, and exportable reports.
- Runnerd hardening: better error translation, resource limit configuration, structured logging.

## Additional Notes
- SQLite DB lives at `sqlite/app.db`; schema auto-initializes via `Storage` class.
- Compose mounts `labs/` and builds frontend/ backend images; `docker compose up` is fastest integration test.
- New FastAPI routes should have tests using dependency overrides (see `backend/tests`).
- Keep security in mind for every runner interaction (no raw shell injection without sanitisation).
