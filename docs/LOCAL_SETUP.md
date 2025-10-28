# 💻 Local Development Setup

Complete guide for running ContainrLab locally with Docker Compose.

---

## Overview

Run the entire ContainrLab stack on your local machine for development, testing, or learning.

**What you get:**
- ✅ Full stack (Frontend, Backend, Runner) running locally
- ✅ Hot reload for code changes
- ✅ Real Docker-in-Docker sessions
- ✅ GitHub OAuth authentication
- ✅ AI hints (with Gemini API key)

**Time to setup:** ~15-20 minutes  
**Prerequisites:** Docker Desktop, Node.js, Python

---

## Prerequisites

### Required Tools

| Tool | Version | Check Command | Install Link |
|------|---------|---------------|--------------|
| **Docker Desktop** | Latest | `docker --version` | [Download](https://www.docker.com/products/docker-desktop/) |
| **Node.js** | 20+ | `node --version` | [Download](https://nodejs.org/) |
| **Python** | 3.11+ | `python --version` | [Download](https://www.python.org/) |
| **Git** | Latest | `git --version` | [Download](https://git-scm.com/) |

**Verify installations:**
```bash
docker --version    # Should be 24.0+
node --version      # Should be v20.0+
python --version    # Should be 3.11+
git --version       # Should be 2.0+
```

---

### External Services

You'll need these external accounts:

| Service | Purpose | Required? | Setup Link |
|---------|---------|-----------|------------|
| **GitHub Account** | OAuth authentication | ✅ Yes | [github.com](https://github.com) |
| **GitHub OAuth App** | Login functionality | ✅ Yes | [Create OAuth App](#create-github-oauth-app) |
| **Google Account** | AI hints | ⚠️ Optional | [google.com](https://google.com) |
| **Gemini API Key** | AI-powered hints | ⚠️ Optional | [Get API Key](https://makersuite.google.com/app/apikey) |

---

## Quick Start

**For the impatient:**

```bash
# 1. Clone
git clone https://github.com/sanjayb-28/ContainrLab.git
cd ContainrLab

# 2. Set up secrets (see detailed steps below)
mkdir -p compose/secrets
echo "your-github-client-id" > compose/secrets/GITHUB_CLIENT_ID.txt
echo "your-github-client-secret" > compose/secrets/GITHUB_CLIENT_SECRET.txt
echo "$(openssl rand -hex 32)" > compose/secrets/NEXTAUTH_SECRET.txt

# 3. Start services
docker compose -f compose/docker-compose.yml up

# 4. Visit http://localhost:3000
```

**For detailed setup, continue reading...**

---

## Step-by-Step Setup

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/sanjayb-28/ContainrLab.git
cd ContainrLab

# Create a development branch (optional)
git checkout -b dev
```

---

### Step 2: Create GitHub OAuth App

**Why:** Authenticate users via GitHub

**Steps:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the form:

| Field | Value |
|-------|-------|
| **Application name** | `ContainrLab Local Dev` |
| **Homepage URL** | `http://localhost:3000` |
| **Application description** | `Local development instance` (optional) |
| **Authorization callback URL** | `http://localhost:3000/api/auth/callback/github` |

4. Click **"Register application"**
5. On the next page, click **"Generate a new client secret"**
6. **Save both values:**
   - Client ID (starts with `Iv1.`)
   - Client Secret (long alphanumeric string)

**⚠️ Important:** Keep these values secret! You'll use them in the next step.

---

### Step 3: Configure Secrets

Create the secrets directory and files:

```bash
# Create secrets directory
mkdir -p compose/secrets
cd compose/secrets

# Create GitHub OAuth secrets
echo "your-github-client-id" > GITHUB_CLIENT_ID.txt
echo "your-github-client-secret" > GITHUB_CLIENT_SECRET.txt

# Generate NextAuth secret (random 32-byte hex)
openssl rand -hex 32 > NEXTAUTH_SECRET.txt

# Optional: Add Gemini API key for AI hints
echo "your-gemini-api-key" > GEMINI_API_KEY.txt

# Return to project root
cd ../..
```

**Verify secrets exist:**
```bash
ls -la compose/secrets/
# Should show:
# GITHUB_CLIENT_ID.txt
# GITHUB_CLIENT_SECRET.txt
# NEXTAUTH_SECRET.txt
# GEMINI_API_KEY.txt (optional)
```

**[→ Complete secrets management guide](SECRETS_MANAGEMENT.md)**

---

### Step 4: Start Services

**Start all services:**
```bash
docker compose -f compose/docker-compose.yml up
```

**Or start in detached mode (background):**
```bash
docker compose -f compose/docker-compose.yml up -d
```

**What's starting:**
- Frontend (Next.js) on `localhost:3000`
- Backend (FastAPI) on `localhost:8000`
- Runner (RunnerD) on `localhost:8080`

**Wait for services to be ready:**
```
✓ frontend  Started
✓ api       Started
✓ runner    Started
```

---

### Step 5: Verify Installation

**Check services are running:**
```bash
# Check Docker containers
docker compose -f compose/docker-compose.yml ps

# Should show 3 services running:
# frontend  (port 3000)
# api       (port 8000)
# runner    (port 8080)
```

**Test API health:**
```bash
curl http://localhost:8000/healthz
# Expected: {"status":"ok"}
```

**Test frontend:**
```bash
curl http://localhost:3000
# Expected: HTML response
```

**Open in browser:**
```bash
# macOS
open http://localhost:3000

# Linux
xdg-open http://localhost:3000

# Windows
start http://localhost:3000
```

---

### Step 6: Sign In

1. Go to `http://localhost:3000`
2. Click **"Sign in with GitHub"**
3. Authorize the OAuth app
4. You should be redirected back to ContainrLab
5. You're now signed in! 🎉

---

## Development Workflow

### Making Code Changes

**Frontend changes (auto-reload):**
```bash
# Edit any file in frontend/
# Changes automatically detected
# Browser refreshes automatically
```

**Backend changes (auto-reload):**
```bash
# Edit any file in backend/
# FastAPI reloads automatically
# API immediately reflects changes
```

**Runner changes (requires rebuild):**
```bash
# Edit files in runner/ or runnerd/
docker compose -f compose/docker-compose.yml restart runner
```

---

### Viewing Logs

**All services:**
```bash
docker compose -f compose/docker-compose.yml logs -f
```

**Specific service:**
```bash
# Frontend logs
docker compose -f compose/docker-compose.yml logs -f frontend

# Backend logs
docker compose -f compose/docker-compose.yml logs -f api

# Runner logs
docker compose -f compose/docker-compose.yml logs -f runner
```

**Filter by keyword:**
```bash
docker compose -f compose/docker-compose.yml logs | grep ERROR
```

---

### Running Tests

**Backend tests:**
```bash
# Enter backend container
docker compose -f compose/docker-compose.yml exec api bash

# Run tests
pytest

# Exit container
exit
```

**Or run directly:**
```bash
cd backend
python -m pytest
```

**Frontend tests:**
```bash
cd frontend
npm test
```

---

### Database Access

**SQLite database location:**
- Container: `/sqlite/app.db`
- Host: `sqlite/app.db` (if volume mounted)

**Access database:**
```bash
# Enter backend container
docker compose -f compose/docker-compose.yml exec api bash

# Use sqlite3
sqlite3 /sqlite/app.db

# Example queries
.tables
SELECT * FROM users;
.quit
```

---

### Stopping Services

**Stop all services:**
```bash
docker compose -f compose/docker-compose.yml down
```

**Stop and remove volumes:**
```bash
docker compose -f compose/docker-compose.yml down -v
```

**Stop specific service:**
```bash
docker compose -f compose/docker-compose.yml stop frontend
```

---

## Services Overview

### Frontend (Next.js)

**Port:** 3000  
**URL:** http://localhost:3000

**What it does:**
- Serves the web UI
- Handles OAuth flow
- Provides terminal and editor
- Connects to backend API

**Environment variables:**
```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000
GITHUB_CLIENT_ID=<from-secret-file>
GITHUB_CLIENT_SECRET=<from-secret-file>
NEXTAUTH_SECRET=<from-secret-file>
NEXTAUTH_URL=http://localhost:3000
```

**[→ Frontend documentation](../frontend/README.md)**

---

### Backend (FastAPI)

**Port:** 8000  
**URL:** http://localhost:8000

**What it does:**
- REST API for all operations
- WebSocket proxy to runner
- User authentication
- Judge orchestration
- Database management

**Key endpoints:**
- `GET /healthz` - Health check
- `GET /docs` - Swagger documentation
- `POST /labs/{lab}/start` - Start lab session
- `POST /judge/{lab}` - Submit for judging

**Environment variables:**
```bash
GITHUB_CLIENT_ID=<from-secret-file>
GITHUB_CLIENT_SECRET=<from-secret-file>
GEMINI_API_KEY=<from-secret-file>
RUNNERD_BASE_URL=http://runner:8080
DATABASE_URL=sqlite:////sqlite/app.db
```

**[→ Backend documentation](../backend/README.md)**

---

### Runner (RunnerD)

**Port:** 8080  
**URL:** http://localhost:8080 (internal only)

**What it does:**
- Spawns Docker-in-Docker session containers
- Manages session lifecycle
- Executes Docker commands
- Provides terminal access

**Key endpoints:**
- `POST /sessions` - Create session
- `POST /sessions/{id}/build` - Build image
- `GET /sessions/{id}/terminal/ws` - Terminal WebSocket
- `DELETE /sessions/{id}` - End session

**Requires:**
- Privileged mode (for Docker-in-Docker)
- Docker socket mounted

**[→ Runner documentation](../runner/README.md)**

---

## Common Tasks

### Add a New Lab

1. Create lab directory:
```bash
mkdir -p labs/lab4
cd labs/lab4
```

2. Create lab files:
```bash
touch description.md  # Lab requirements
touch solution.md     # Reference solution
mkdir starter         # Starter workspace
```

3. Create judge:
```bash
# In judge/
touch lab4.py
```

4. Test locally:
```bash
# Start a session and test
```

---

### Update Dependencies

**Backend:**
```bash
cd backend
pip install new-package
pip freeze > requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install new-package
# package.json automatically updated
```

**Rebuild containers:**
```bash
docker compose -f compose/docker-compose.yml build
docker compose -f compose/docker-compose.yml up
```

---

### Reset Database

```bash
# Stop services
docker compose -f compose/docker-compose.yml down

# Remove database file
rm sqlite/app.db

# Start services (database recreated)
docker compose -f compose/docker-compose.yml up
```

---

### Clean Docker Resources

**Remove stopped containers:**
```bash
docker compose -f compose/docker-compose.yml rm
```

**Remove all session containers:**
```bash
docker ps -a | grep sess- | awk '{print $1}' | xargs docker rm -f
```

**Remove unused images:**
```bash
docker image prune
```

**Full cleanup:**
```bash
docker compose -f compose/docker-compose.yml down -v
docker system prune -a
```

---

## Troubleshooting

### Services Won't Start

**Problem:** `docker compose up` fails

**Check:**
1. Docker Desktop is running
2. No port conflicts (3000, 8000, 8080)
3. Secrets files exist

**Solution:**
```bash
# Check Docker
docker ps

# Check ports
lsof -i :3000
lsof -i :8000
lsof -i :8080

# Verify secrets
ls -la compose/secrets/
```

---

### "Secret file not found" Error

**Problem:** Container can't read secrets

**Solution:**
```bash
# Create missing secrets
mkdir -p compose/secrets
echo "your-value" > compose/secrets/SECRET_NAME.txt

# Restart services
docker compose -f compose/docker-compose.yml restart
```

**[→ Complete secrets troubleshooting](SECRETS_MANAGEMENT.md#troubleshooting)**

---

### GitHub OAuth "Redirect URI Mismatch"

**Problem:** OAuth fails with redirect error

**Solution:**
1. Go to GitHub OAuth App settings
2. Verify Authorization callback URL is: `http://localhost:3000/api/auth/callback/github`
3. Update if needed
4. Try again

---

### Frontend Won't Connect to Backend

**Problem:** API requests fail with CORS or connection errors

**Check:**
```bash
# Verify backend is running
curl http://localhost:8000/healthz

# Check frontend environment
docker compose -f compose/docker-compose.yml exec frontend env | grep API
```

**Solution:**
```bash
# Should be: NEXT_PUBLIC_API_BASE=http://localhost:8000
# Restart if incorrect
docker compose -f compose/docker-compose.yml restart frontend
```

---

### Runner Can't Create Sessions

**Problem:** "Cannot create session container"

**Check:**
1. Runner has access to Docker socket
2. Docker daemon is running

**Solution:**
```bash
# Check Docker socket mount
docker compose -f compose/docker-compose.yml exec runner ls -la /var/run/docker.sock

# Restart Docker Desktop
# Restart runner
docker compose -f compose/docker-compose.yml restart runner
```

---

### Port Already in Use

**Problem:** "Port 3000 is already allocated"

**Find what's using the port:**
```bash
# macOS/Linux
lsof -i :3000

# Kill the process
kill -9 <PID>
```

**Or change the port:**
```yaml
# In compose/docker-compose.yml
services:
  frontend:
    ports:
      - "3001:3000"  # Use 3001 instead
```

---

### Hot Reload Not Working

**Problem:** Code changes don't reflect

**For Frontend:**
```bash
# Check if files are mounted
docker compose -f compose/docker-compose.yml exec frontend ls -la /app

# Restart with clean build
docker compose -f compose/docker-compose.yml up --build
```

**For Backend:**
```bash
# Check FastAPI logs for reload messages
docker compose -f compose/docker-compose.yml logs -f api
```

---

### Out of Disk Space

**Problem:** Docker running out of space

**Check usage:**
```bash
docker system df
```

**Clean up:**
```bash
# Remove unused data
docker system prune -a

# Remove old session containers
docker ps -a | grep sess- | awk '{print $1}' | xargs docker rm -f

# Remove unused volumes
docker volume prune
```

---

## Tips & Best Practices

### 1. Use Detached Mode for Development

```bash
# Start in background
docker compose -f compose/docker-compose.yml up -d

# View logs when needed
docker compose -f compose/docker-compose.yml logs -f

# Stop when done
docker compose -f compose/docker-compose.yml down
```

---

### 2. Tail Specific Service Logs

```bash
# Only backend logs
docker compose -f compose/docker-compose.yml logs -f api

# Last 100 lines
docker compose -f compose/docker-compose.yml logs --tail 100 api
```

---

### 3. Use Docker Compose Profiles

```yaml
# In docker-compose.yml
services:
  debugging-tools:
    profiles: ["debug"]
```

```bash
# Start with debug profile
docker compose --profile debug up
```

---

### 4. Rebuild Only Changed Services

```bash
# Only rebuild backend
docker compose -f compose/docker-compose.yml build api
docker compose -f compose/docker-compose.yml up -d api
```

---

### 5. Export Environment Variables

```bash
# Create .env file (gitignored)
cat > .env << EOF
COMPOSE_FILE=compose/docker-compose.yml
COMPOSE_PROJECT_NAME=containrlab
EOF

# Now you can just use
docker compose up
```

---

## VS Code Setup (Optional)

### Recommended Extensions

- Docker
- Python
- ESLint
- Prettier
- GitLens

### Dev Container

```bash
# Open in VS Code
code .

# Install "Dev Containers" extension
# Reopen in container
```

---

## Next Steps

**Once local setup is working:**

1. **Explore the codebase**
   - [Backend structure](../backend/README.md)
   - [Frontend structure](../frontend/README.md)
   - [Judge system](../judge/README.md)

2. **Try the labs**
   - [Lab catalog](../labs/README.md)
   - Create a session
   - Test the judge system

3. **Contribute**
   - Fix bugs
   - Add features
   - Create new labs
   - Improve documentation

4. **Deploy to AWS**
   - [Deployment guide](DEPLOYMENTS.md)
   - [CI/CD setup](CI_CD_SETUP.md)

---

## Related Documentation

- **[Architecture](ARCHITECTURE.md)** - System design and components
- **[Secrets Management](SECRETS_MANAGEMENT.md)** - Managing credentials
- **[Compose README](../compose/README.md)** - Docker Compose details
- **[Backend README](../backend/README.md)** - API documentation
- **[Frontend README](../frontend/README.md)** - Web app documentation
- **[Runner README](../runner/README.md)** - Runner service details

---

<div align="center">

**[← Back to Documentation](README.md)** | **[Deploy to AWS →](DEPLOYMENTS.md)**

</div>
