# 🐳 Docker Compose Setup

Local development environment configuration for ContainrLab.

---

## Overview

This directory contains Docker Compose configuration for running the entire ContainrLab stack locally:

- **Frontend** - Next.js web application (port 3000)
- **Backend** - FastAPI service (port 8000)
- **Runner** - Docker-in-Docker service (port 8080)
- **Database** - SQLite (ephemeral, in backend container)

---

## Quick Start

```bash
# Set up secrets first
echo "your-github-client-id" > compose/secrets/GITHUB_CLIENT_ID.txt
echo "your-github-client-secret" > compose/secrets/GITHUB_CLIENT_SECRET.txt
echo "your-gemini-api-key" > compose/secrets/GEMINI_API_KEY.txt  # Optional

# Start all services
docker compose -f compose/docker-compose.yml up

# Access the app
open http://localhost:3000
```

---

## Directory Structure

```
compose/
├── docker-compose.yml    # Main compose configuration
└── secrets/              # Secret files (gitignored)
    ├── GITHUB_CLIENT_ID.txt
    ├── GITHUB_CLIENT_SECRET.txt
    └── GEMINI_API_KEY.txt
```

---

## Services

### Frontend (web)
- **Image:** Built from `../frontend/Dockerfile`
- **Port:** 3000 → http://localhost:3000
- **Environment:**
  - `NEXT_PUBLIC_API_BASE=http://localhost:8000`
  - GitHub OAuth credentials (from secrets)

### Backend (api)
- **Image:** Built from `../backend/Dockerfile`
- **Port:** 8000 → http://localhost:8000
- **Environment:**
  - `RUNNERD_BASE_URL=http://runner:8080`
  - GitHub OAuth credentials (from secrets)
  - Gemini API key (optional, from secrets)
- **Volumes:** SQLite database persists in container

### Runner (runner)
- **Image:** Built from `../runner/Dockerfile`
- **Port:** 8080 (internal)
- **Privileged:** Yes (required for Docker-in-Docker)
- **Volumes:** Docker socket mounted

---

## Secrets Management

Secrets are stored in `compose/secrets/` and mounted as Docker secrets.

**Required secrets:**
```bash
# GitHub OAuth (get from https://github.com/settings/developers)
GITHUB_CLIENT_ID.txt
GITHUB_CLIENT_SECRET.txt

# NextAuth (generate random string)
NEXTAUTH_SECRET.txt
```

**Optional secrets:**
```bash
# Google Gemini API (get from https://makersuite.google.com/app/apikey)
GEMINI_API_KEY.txt
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32 > compose/secrets/NEXTAUTH_SECRET.txt
```

---

## Common Commands

```bash
# Start in detached mode
docker compose -f compose/docker-compose.yml up -d

# View logs
docker compose -f compose/docker-compose.yml logs -f

# Stop services
docker compose -f compose/docker-compose.yml down

# Rebuild images
docker compose -f compose/docker-compose.yml build

# Clean up everything (including volumes)
docker compose -f compose/docker-compose.yml down -v
```

---

## Troubleshooting

### Port already in use
```bash
# Check what's using the port
lsof -i :3000  # or :8000, :8080

# Kill the process
kill -9 <PID>
```

### Runner not starting
- Ensure Docker Desktop is running
- Check if privileged mode is enabled
- Verify Docker socket is accessible

### Secret files not found
```bash
# Ensure secrets directory exists
mkdir -p compose/secrets

# Check file permissions
ls -la compose/secrets/
```

---

## Related Documentation

- [Local Development Runbook](../docs/LOCAL_RUNBOOK.md) - Detailed setup guide
- [Architecture](../docs/ARCHITECTURE.md) - System architecture
- [Main README](../README.md) - Project overview

---

**Note:** This is for local development only. Production deployment uses AWS ECS. See [Deployment Guide](../docs/DEPLOYMENTS.md).

Docker Compose configuration, Nginx templates, and environment files for the EC2 stack.
