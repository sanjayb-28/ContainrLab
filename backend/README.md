# Backend API Service

FastAPI application providing REST API, WebSocket proxy, and session management.

---

## Quick Start

### Local Development

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Set environment variables
export GITHUB_CLIENT_ID="your-client-id"
export GITHUB_CLIENT_SECRET="your-client-secret"
export RUNNERD_BASE_URL="http://localhost:8080"

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
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

### Labs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/labs` | GET | List all available labs |
| `/labs/{slug}` | GET | Get lab details |
| `/labs/{slug}/start` | POST | Start lab session |

### Sessions
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sessions` | GET | List user's sessions |
| `/sessions/{id}` | GET | Get session details |
| `/sessions/{id}` | DELETE | End session |
| `/sessions/{id}/terminal/ws` | WebSocket | Terminal connection |

### Files
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/files` | GET | List workspace files |
| `/files` | POST | Create file |
| `/files/{path}` | GET | Read file content |
| `/files/{path}` | PUT | Update file |
| `/files/{path}` | DELETE | Delete file |

### Judge
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/judge/{lab}` | POST | Submit lab for validation |
| `/attempts` | GET | List judge attempts |
| `/attempts/{id}` | GET | Get attempt details |

### AI Assistant
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent/hint` | POST | Get AI hint for current step |
| `/agent/explain` | POST | Get explanation of concept |

---

## Environment Variables

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Runner
RUNNERD_BASE_URL=http://localhost:8080

# Google Gemini (optional)
GEMINI_API_KEY=your-api-key

# Session config
SESSION_TTL_SECONDS=2700
SESSION_CLEANUP_INTERVAL_SECONDS=60
SESSION_TTL_GRACE_SECONDS=120
```

---

## Database Schema

**Users Table:**
```sql
CREATE TABLE users (
    github_id INTEGER PRIMARY KEY,
    login TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Sessions Table:**
```sql
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    lab_slug TEXT NOT NULL,
    runner_container TEXT,
    ttl_seconds INTEGER DEFAULT 2700,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(github_id)
);
```

**Judge Attempts Table:**
```sql
CREATE TABLE judge_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    lab_slug TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    failures TEXT,
    metrics TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

---

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_sessions.py -v
```

---

## Related Documentation

- [Architecture](../docs/ARCHITECTURE.md) - System design
- [Deployment](../docs/DEPLOYMENT.md) - Deploy to production
- [Main README](../README.md) - Project overview
