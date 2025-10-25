# ContainrLab MVP Status

_Last updated: 2025-10-22_

This document tracks the remaining work to reach the MVP milestones described in `plan.txt`. It supplements `roadmap.txt` and should be refreshed whenever major tasks land.

## Completed

### Infrastructure & Platform
- Single-machine Docker Compose stack (web, api, runnerd, redis, nginx).
- Runnerd service for session lifecycle (start/stop/build/run/exec/fs/terminal).
- FastAPI backend exposing session endpoints, filesystem service, inspector metrics (layer history, cache hits, deltas), live Gemini agent, terminal proxy.
- Next.js frontend with lab list/detail, nested workspace explorer + Monaco editor, dirty-state handling, terminal, inspector dashboard, and agent drawer with request history.
- SQLite persistence for sessions & judge attempts.
- Three labs shipped: Lab 1 (First Dockerfile), Lab 2 (Layers & Cache), and Lab 3 (Multi-Stage Builds) with automated judges.

### Tooling & Automation
- Smoke script validates session start/build/run/judge + filesystem list.
- **End-to-end smoke script** (`scripts/e2e_smoke.py`) covers login, patch apply, judge, timeline fetch.
- Backend unit tests for storage, sessions router, judge logic, agent, runner filesystem.
- Frontend lint/build integrated into docker images.

### Documentation
- Full local runbook & auth walkthrough (`docs/LOCAL_RUNBOOK.md`).
- Gemini configuration & fallback guide (`docs/GEMINI_SETUP.md`).

## In Progress / To Do

### Curriculum
- Additional labs outlined in `plan.txt` (health checks, secrets, volumes, etc.).

### Agent & Telemetry
- Persist agent interaction data for analytics (optional, post-MVP).
- Extend agent with patch suggestion workflow and apply tooling.
- Capture structured backend metrics (per-request logging, token usage).

### Workspace UX
- Autosave / live build trigger toggle in editor.
- Breadcrumb polish and keyboard shortcuts for explorer.
- Split-view editor and terminal layout refinements.

### Inspector & Analytics
- Visual layer diffing, attempt timeline view, and exportable build reports.
- Capture judge results and metrics for analytics dashboards.

### Authentication & Sessions
- Lightweight auth (magic link / Auth0/GitHub) for user isolation (per MVP schedule).
- Session TTL enforcement beyond manual stop (cron cleanup, frontend warning).

### Infra Hardening
- Runnerd resource configuration via env vars (CPU/mem overrides, concurrency).
- Structured logging/monitoring (e.g., per-session log IDs).
- Security review (path sanitisation audit, network policy, secrets handling).

### Documentation
- Public-facing docs for each lab (problem statements, hints, solution outline).

## Stretch / Post-MVP
- Scale-out architecture (ECS/Fargate, multi-runner hosts).
- Persistent workspace snapshots (S3 uploads), resume support.
- Advanced labs (security, SBOM, multi-arch builds, capstone).
- CI pipeline for lint/tests and automated smoke in GitHub Actions.

---
Update this checklist as work lands to keep everyone aligned on MVP readiness.
