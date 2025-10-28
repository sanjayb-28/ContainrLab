# ⚡ Backend API Service

FastAPI application providing REST API, WebSocket proxy, and judge orchestration.

---

## Overview

The backend is the central hub of ContainrLab, handling:
- **REST API** for all operations
- **WebSocket proxy** to runner for terminal
- **User authentication** via GitHub OAuth
- **Judge orchestration** for lab validation
- **Database management** (SQLite)
- **AI integration** (Google Gemini)

**Technology:** Python 3.11, FastAPI, SQLite, HTTPX, WebSockets

---

## Quick Start

### Local Development

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Set up secrets (see docs/SECRETS_MANAGEMENT.md)
export GITHUB_CLIENT_ID="your-client-id"
export GITHUB_CLIENT_SECRET="your-client-secret"
export RUNNERD_BASE_URL="http://localhost:8080"

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Or with Docker Compose:**
```bash
docker compose -f compose/docker-compose.yml up api
```

---

## API Endpoints

### Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/github` | GET | Initiate GitHub OAuth flow |
| `/auth/callback` | GET | OAuth callback handler |
| `/auth/me` | GET | Get current user info |

---

### Labs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/labs` | GET | List all available labs |
| `/labs/{slug}` | GET | Get lab details |
| `/labs/{slug}/start` | POST | Start lab session |

---

### Sessions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sessions` | GET | List user's sessions |
| `/sessions/{id}` | GET | Get session details |
| `/sessions/{id}` | DELETE | End session |
| `/sessions/{id}/terminal/ws` | WebSocket | Terminal connection |

---

### Files

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/files` | GET | List workspace files |
| `/files` | POST | Create file |
| `/files/{path}` | GET | Read file content |
| `/files/{path}` | PUT | Update file |
| `/files/{path}` | DELETE | Delete file |

---

### Judge

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/judge/{lab}` | POST | Submit lab for validation |
| `/attempts` | GET | List judge attempts |
| `/attempts/{id}` | GET | Get attempt details |

---

### AI Agent

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent/hint` | POST | Get AI hint for current step |
| `/agent/explain` | POST | Get AI explanation of concept |

---

### Health

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/healthz` | GET | Health check |
| `/docs` | GET | Swagger API documentation |

---

## Architecture

### Service Layer

```
main.py (FastAPI app)
    ↓
routers/
├── auth.py          # GitHub OAuth
├── labs.py          # Lab management
├── sessions.py      # Session CRUD + WebSocket
├── files.py         # File operations
├── judge.py         # Lab validation
└── agent.py         # AI hints

services/
├── auth_service.py      # User authentication
├── session_manager.py   # Session tracking
├── runner_client.py     # HTTP client to runner
├── agent_service.py     # Gemini AI integration
└── judge_service.py     # Judge orchestration

judge/
├── lab1.py          # Lab 1 validation
├── lab2.py          # Lab 2 validation
└── lab3.py          # Lab 3 validation

models/
├── user.py          # User data model
├── session.py       # Session data model
├── judge_result.py  # Judge result model
└── database.py      # SQLite connection
```

---

## Configuration

### Environment Variables

**Required:**
```bash
GITHUB_CLIENT_ID=xxx              # GitHub OAuth app ID
GITHUB_CLIENT_SECRET=xxx          # GitHub OAuth secret
RUNNERD_BASE_URL=http://runner:8080  # Runner service URL
```

**Optional:**
```bash
# Gemini AI (for hints)
GEMINI_API_KEY=xxx                    # Google Gemini API key
GEMINI_MODEL=models/gemini-1.5-flash  # Model to use
GEMINI_TEMPERATURE=0.7                # Response creativity
GEMINI_MAX_OUTPUT_TOKENS=512          # Max response length
GEMINI_TIMEOUT_SECONDS=20             # API timeout

# Database
DATABASE_URL=sqlite:////sqlite/app.db  # SQLite file path

# CORS
ALLOWED_ORIGINS=http://localhost:3000  # Frontend URL
```

**Using Docker Secrets:**
```bash
# Secrets are read from files
GITHUB_CLIENT_ID_FILE=/run/secrets/GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET_FILE=/run/secrets/GITHUB_CLIENT_SECRET
GEMINI_API_KEY_FILE=/run/secrets/GEMINI_API_KEY
```

**[→ Complete secrets guide](../docs/SECRETS_MANAGEMENT.md)**

---

## Development

### Running Tests

```bash
# All tests
pytest

# Specific test file
pytest tests/test_auth.py

# With coverage
pytest --cov=. --cov-report=html

# Watch mode
ptw
```

---

### Code Formatting

```bash
# Check formatting
black --check .

# Format code
black .

# Type checking
mypy .
```

---

### Database

**SQLite database location:**
- Local: `sqlite/app.db`
- Docker: `/sqlite/app.db`

**Access database:**
```bash
sqlite3 sqlite/app.db

# List tables
.tables

# Query users
SELECT * FROM users;

# Query sessions
SELECT * FROM sessions WHERE user_id = 1;

# Exit
.quit
```

**Reset database:**
```bash
rm sqlite/app.db
# Database will be recreated on next startup
```

---

### Adding a New Endpoint

**1. Create route:**
```python
# routers/example.py
from fastapi import APIRouter

router = APIRouter(prefix="/example", tags=["example"])

@router.get("/")
async def get_example():
    return {"message": "Hello"}
```

**2. Register router:**
```python
# main.py
from routers import example

app.include_router(example.router)
```

**3. Test:**
```bash
curl http://localhost:8000/example
```

---

## AI Integration (Gemini)

### Overview

Google Gemini provides contextual hints and explanations to learners.

**Features:**
- Contextual hints based on current lab
- Code explanations
- Error message interpretation
- Rate limited: 5 requests/minute per session

---

### Configuration

```bash
# Get API key from https://makersuite.google.com/app/apikey
export GEMINI_API_KEY="your-api-key"

# Optional tuning
export GEMINI_MODEL="models/gemini-1.5-flash"
export GEMINI_TEMPERATURE="0.7"
export GEMINI_MAX_OUTPUT_TOKENS="512"
```

**Using Docker secrets:**
```bash
echo "your-api-key" > compose/secrets/GEMINI_API_KEY.txt
export GEMINI_API_KEY_FILE="$(pwd)/compose/secrets/GEMINI_API_KEY.txt"
```

---

### Fallback Behavior

**If API key is missing:**
- Stub responses returned
- System remains functional
- No AI features, but no errors

**If API fails:**
- Graceful degradation
- Error logged but not shown to user
- Fallback to deterministic guidance

---

### Rate Limiting

**In-process rate limit:**
- 5 requests per minute per session
- Prevents API quota exhaustion
- Returns 429 if exceeded

```python
# services/agent_service.py
rate_limiter = RateLimiter(max_requests=5, window_seconds=60)
```

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    github_id INTEGER PRIMARY KEY,
    login TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Sessions Table

```sql
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    lab_slug TEXT NOT NULL,
    runner_container TEXT,
    ttl_seconds INTEGER DEFAULT 1800,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(github_id)
);
```

---

### Judge Attempts Table

```sql
CREATE TABLE judge_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    lab_slug TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    failures TEXT,  -- JSON
    metrics TEXT,   -- JSON
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

---

## Judge System

### How It Works

```
User submits lab
    ↓
POST /judge/{lab_slug}
    ↓
judge_service.evaluate(lab_slug, session_id)
    ↓
Lab-specific judge (judge/lab1.py)
    ↓
1. Read user's files via runner
2. Validate Dockerfile structure
3. Build image via runner
4. Run container via runner
5. Test functionality
6. Check metrics (size, etc.)
    ↓
Return JudgeResult
    ↓
Frontend displays results
```

---

### Judge Result Model

```python
class JudgeResult:
    passed: bool
    failures: List[JudgeFailure]
    metrics: Dict[str, Any]
    notes: Dict[str, List[str]]

class JudgeFailure:
    code: str
    message: str
    hint: str
```

**Example:**
```json
{
  "passed": false,
  "failures": [
    {
      "code": "MISSING_DOCKERIGNORE",
      "message": ".dockerignore file not found",
      "hint": "Create a .dockerignore file to exclude unnecessary files"
    }
  ],
  "metrics": {
    "build": {"elapsed_seconds": 5.2},
    "image_size_mb": 280
  },
  "notes": {
    "build_logs": ["Step 1/5 : FROM python:3.11-slim", ...]
  }
}
```

**[→ Complete judge documentation](../judge/README.md)**

---

## Security

### Authentication Flow

```
User clicks "Sign in with GitHub"
    ↓
Redirect to GitHub OAuth
    ↓
User authorizes app
    ↓
GitHub redirects back with code
    ↓
Backend exchanges code for access token
    ↓
Backend fetches user profile from GitHub API
    ↓
Backend creates/updates user in database
    ↓
Backend returns JWT session token
    ↓
Frontend stores JWT in HTTP-only cookie
```

**Token validation:**
- Every API request validates JWT
- Expired tokens return 401
- User must re-authenticate

---

### Runner Communication

**Security considerations:**
- Runner should only be accessible from backend
- No direct user access to runner
- Backend validates all session requests
- Session IDs are UUIDs (non-guessable)

**Network:**
- Docker network: backend ←→ runner
- No external access to runner port

---

## Performance

### Caching

**Runner client caching:**
```python
# Cache session info to reduce runner calls
@lru_cache(maxsize=128)
def get_session_info(session_id: str) -> SessionInfo:
    # ...
```

---

### Database Connection Pooling

```python
# SQLite doesn't use pooling, but we limit concurrent writes
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
```

---

### Async Operations

```python
# All I/O operations are async
async def create_session(user_id: int, lab_slug: str) -> Session:
    # Database write
    async with get_db() as db:
        # ...
    
    # Runner call
    async with httpx.AsyncClient() as client:
        response = await client.post(...)
    
    return session
```

---

## Troubleshooting

### "Runner connection refused"

**Problem:** Backend can't reach runner

**Check:**
```bash
# Verify runner is running
docker ps | grep runner

# Test runner directly
curl http://localhost:8080/health

# Check network
docker network inspect compose_default
```

---

### "GitHub OAuth fails"

**Problem:** OAuth redirect error

**Check:**
1. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set
2. OAuth app callback URL matches: `http://localhost:3000/api/auth/callback/github`
3. Frontend URL in `ALLOWED_ORIGINS`

---

### "Database locked"

**Problem:** SQLite write contention

**Solution:**
- SQLite doesn't handle concurrent writes well
- For production, use PostgreSQL
- For development, this is rare

---

### "Gemini API fails"

**Problem:** AI hints not working

**Check:**
```bash
# Verify API key is set
echo $GEMINI_API_KEY

# Test directly
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

**Fallback:**
- System works without Gemini
- Returns stub responses

---

## Production Deployment

### AWS ECS

Backend runs on ECS Fargate with:
- ARM64 architecture
- 0.25 vCPU, 512MB RAM
- Secrets from SSM Parameter Store
- CloudWatch logs

**Task definition:** `infra/task-definitions/api-web-task.json`

**[→ Complete deployment guide](../docs/DEPLOYMENTS.md)**

---

### Environment Variables in Production

```json
{
  "secrets": [
    {
      "name": "GITHUB_CLIENT_ID",
      "valueFrom": "arn:aws:ssm:us-east-1:ACCOUNT:parameter/containrlab/GITHUB_CLIENT_ID"
    },
    {
      "name": "GITHUB_CLIENT_SECRET",
      "valueFrom": "arn:aws:ssm:us-east-1:ACCOUNT:parameter/containrlab/GITHUB_CLIENT_SECRET"
    }
  ]
}
```

---

## Related Documentation

- **[System Architecture](../docs/ARCHITECTURE.md)** - How backend fits in the system
- **[Local Setup](../docs/LOCAL_SETUP.md)** - Running backend locally
- **[Secrets Management](../docs/SECRETS_MANAGEMENT.md)** - Managing credentials
- **[Judge System](../judge/README.md)** - Lab validation details
- **[Runner Service](../runner/README.md)** - Docker-in-Docker service

---

<div align="center">

**[← Back to Documentation](../docs/README.md)**

</div>
