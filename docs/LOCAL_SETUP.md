# Local Development Setup

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
| **Python** | 3.12+ | `python --version` | [Download](https://www.python.org/) |
| **Git** | Latest | `git --version` | [Download](https://git-scm.com/) |

**Verify installations:**
```bash
docker --version    # Should be 24.0+
node --version      # Should be v20.0+
python --version    # Should be 3.12+
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
5. You're now signed in!

**✅ Setup complete!** You can now start a lab session and begin coding.

---

## Common Issues

### Services Won't Start

**Problem:** `docker compose up` fails

**Solutions:**
1. Verify Docker Desktop is running: `docker ps`
2. Check for port conflicts: `lsof -i :3000` (or :8000, :8080)
3. Verify secrets exist: `ls -la compose/secrets/`
4. Check logs: `docker compose -f compose/docker-compose.yml logs`

---

### GitHub OAuth Redirect Error

**Problem:** "Redirect URI mismatch" when signing in

**Solution:**
1. Go to your [GitHub OAuth App settings](https://github.com/settings/developers)
2. Verify callback URL is **exactly**: `http://localhost:3000/api/auth/callback/github`
3. Save and try again

---

### Port Already in Use

**Problem:** "Port 3000 is already allocated"

**Solution:**
```bash
# Find what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>
```

---

## Stopping Services

```bash
# Stop all services
docker compose -f compose/docker-compose.yml down

# Stop and clean up everything
docker compose -f compose/docker-compose.yml down -v
```

---

## Next Steps

**Now that you're running locally:**

1. **Try a lab** - Visit http://localhost:3000 and start Lab 1
2. **Development workflow** - See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
   - Making code changes
   - Running tests
   - Viewing logs
   - Adding new labs
3. **Understand the system** - Read [ARCHITECTURE.md](ARCHITECTURE.md)
4. **Deploy to AWS** - Follow [DEPLOYMENT.md](DEPLOYMENT.md)

---

## Related Documentation

- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Development workflow and best practices
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design and components
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - AWS deployment guide
- **[Component READMEs](../backend/README.md)** - Backend, Frontend, Runner, Judge details

---

<div align="center">

**[← Back to Documentation](README.md)** | **[Deploy to AWS →](DEPLOYMENT.md)**

</div>
