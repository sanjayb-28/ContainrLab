# Runner Service

Docker-in-Docker service for isolated lab environments.

---

## Overview

RunnerD provides isolated Docker-in-Docker containers for each user session, enabling:
- Safe Docker command execution
- Isolated lab environments
- File system access
- Terminal access via WebSocket
- Container lifecycle management

---

## API Endpoints

### Session Management

**Create Session:**
```http
POST /sessions
Content-Type: application/json

{
  "session_id": "sess-abc123",
  "ttl_seconds": 2700
}
```

**Get Session:**
```http
GET /sessions/{session_id}
```

**Delete Session:**
```http
DELETE /sessions/{session_id}
```

---

### Docker Operations

**Build Image:**
```http
POST /sessions/{session_id}/build
Content-Type: application/json

{
  "context_path": "/workspace",
  "dockerfile_path": "Dockerfile",
  "image_tag": "my-image:latest"
}
```

**Run Container:**
```http
POST /sessions/{session_id}/run
Content-Type: application/json

{
  "image": "my-image:latest",
  "ports": ["8080:8080"],
  "detach": true
}
```

**Execute Command:**
```http
POST /sessions/{session_id}/exec
Content-Type: application/json

{
  "command": ["ls", "-la"],
  "workdir": "/workspace"
}
```

---

### File Operations

**List Files:**
```http
GET /files?session_id={session_id}&path=/workspace
```

**Read File:**
```http
GET /files/{path}?session_id={session_id}
```

**Write File:**
```http
PUT /files/{path}?session_id={session_id}
Content-Type: application/json

{
  "content": "file contents here"
}
```

**Delete File:**
```http
DELETE /files/{path}?session_id={session_id}
```

---

### Terminal WebSocket

**Connect:**
```
ws://localhost:8080/sessions/{session_id}/terminal/ws
```

**Messages:**
```json
{"type": "input", "data": "ls -la\n"}
{"type": "resize", "rows": 24, "cols": 80}
```

---

## Environment Variables

```bash
# Session configuration
SESSION_TTL_SECONDS=2700          # Default session duration (45 min)
SESSION_CLEANUP_INTERVAL_SECONDS=300  # Cleanup job interval
RUNNER_MEMORY=1536m               # Memory per session container
```

---

## Local Testing

```bash
# Run RunnerD locally
cd runner/supervisor
python -m uvicorn main:app --reload --port 8080

# Test session creation
curl -X POST http://localhost:8080/sessions \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test-123", "ttl_seconds": 2700}'
```

---

## Related Documentation

- [Architecture](../docs/ARCHITECTURE.md) - System design
- [Deployment](../docs/DEPLOYMENT.md) - Deploy to production
- [Main README](../README.md) - Project overview
