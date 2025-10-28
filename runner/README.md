# 🔧 Runner Service

Docker-in-Docker service for isolated lab environments in ContainrLab.

---

## Overview

The Runner service (RunnerD) provides isolated Docker-in-Docker containers for each user session, enabling:
- Safe Docker command execution
- Isolated lab environments
- File system access
- Terminal access
- Container lifecycle management

---

## Architecture

```
┌─────────────────────────────────────────┐
│         RunnerD Service (Port 8080)             │
│  ┌──────────────────────────────────┐ │
│  │    Session Manager                 │ │
│  └──────────────────────────────────┘ │
│                   │                          │
│  ┌─────────────┴───────────────────────┐│
│  │   Docker-in-Docker Sessions        ││
│  │  ┌───────────────────────────────┐ ││
│  │  │  Session Container (sess-abc123) │ ││
│  │  │  - Docker daemon              │ ││
│  │  │  - User workspace (/workspace)│ ││
│  │  │  - Bash terminal              │ ││
│  │  │  - 1.5GB RAM, 1 vCPU          │ ││
│  │  └───────────────────────────────┘ ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

---

## API Endpoints

### Session Management

#### Create Session
```http
POST /sessions
Content-Type: application/json

{
  "session_id": "sess-abc123",
  "ttl_seconds": 1800
}
```

**Response:**
```json
{
  "session_id": "sess-abc123",
  "container_name": "sess-abc123",
  "created_at": "2025-10-27T22:00:00Z",
  "expires_at": "2025-10-27T22:30:00Z"
}
```

#### Get Session Info
```http
GET /sessions/{session_id}
```

#### Delete Session
```http
DELETE /sessions/{session_id}
```

---

### Docker Operations

#### Build Image
```http
POST /sessions/{session_id}/build
Content-Type: application/json

{
  "context_path": "/workspace",
  "dockerfile_path": "Dockerfile",
  "image_tag": "my-image:latest"
}
```

**Response:**
```json
{
  "image_tag": "my-image:latest",
  "logs": ["Step 1/5 : FROM python:3.11-slim", "..."],
  "metrics": {
    "image_size_mb": 185.2,
    "elapsed_seconds": 12.5
  }
}
```

#### Run Container
```http
POST /sessions/{session_id}/run
Content-Type: application/json

{
  "image": "my-image:latest",
  "ports": ["8080:8080"],
  "detach": true,
  "auto_remove": false
}
```

#### Stop Container
```http
POST /sessions/{session_id}/stop
Content-Type: application/json

{
  "container_name": "my-container",
  "timeout": 10,
  "remove": true
}
```

#### Execute Command
```http
POST /sessions/{session_id}/exec
Content-Type: application/json

{
  "command": ["ls", "-la", "/workspace"],
  "workdir": "/workspace"
}
```

**Response:**
```json
{
  "exit_code": 0,
  "logs": ["total 12", "drwxr-xr-x  3 root root 4096 Oct 27 22:00 .", "..."]
}
```

---

### File Operations

#### List Files
```http
GET /sessions/{session_id}/files?path=/workspace
```

#### Read File
```http
GET /sessions/{session_id}/files/workspace/Dockerfile
```

#### Write File
```http
PUT /sessions/{session_id}/files/workspace/app.py
Content-Type: application/json

{
  "content": "print('Hello, World!')"
}
```

#### Delete File
```http
DELETE /sessions/{session_id}/files/workspace/app.py
```

---

### Terminal

#### WebSocket Terminal
```http
GET /sessions/{session_id}/terminal/ws
Upgrade: websocket
```

Provides interactive bash terminal in the session container.

---

## Session Lifecycle

```
1. Backend requests session creation
       ↓
2. RunnerD spawns DinD container
   - Name: sess-{session_id}
   - Image: containrlab-runner:latest
   - Resources: 1.5GB RAM, 1 vCPU
   - TTL: 30 minutes
       ↓
3. Session container starts
   - Docker daemon initializes
   - /workspace directory created
   - Bash shell ready
       ↓
4. User interacts via:
   - Terminal (WebSocket)
   - File operations (HTTP API)
   - Docker commands (HTTP API)
       ↓
5. Session expires or user ends it
       ↓
6. RunnerD stops and removes container
   - All data cleaned up
   - Resources freed
```

---

## Configuration

### Environment Variables

```bash
# Session settings
SESSION_TTL_SECONDS=1800          # Default session duration (30 min)

# Container resources
CONTAINER_MEMORY_LIMIT=1536m      # Memory limit per session
CONTAINER_CPU_LIMIT=1             # CPU cores per session

# Cleanup settings
CLEANUP_INTERVAL_SECONDS=300      # How often to check for expired sessions
```

### Docker Socket

RunnerD requires access to the Docker daemon:

**Local Development:**
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
privileged: true
```

**AWS ECS (EC2):**
- EC2 instance runs Docker
- RunnerD task runs on EC2 (not Fargate)
- Socket mounted from host

---

## Development

### Running Locally

```bash
# Using Docker Compose
docker compose -f compose/docker-compose.yml up runner

# Or run standalone
docker build -t containrlab-runner runner/
docker run -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --privileged \
  containrlab-runner
```

### Testing

```bash
# Create a test session
curl -X POST http://localhost:8080/sessions \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test-123", "ttl_seconds": 1800}'

# Execute a command
curl -X POST http://localhost:8080/sessions/test-123/exec \
  -H "Content-Type: application/json" \
  -d '{"command": ["echo", "Hello, World!"]}'

# Clean up
curl -X DELETE http://localhost:8080/sessions/test-123
```

---

## Security

### Container Isolation

- Each session runs in isolated container
- No network access between sessions
- Resource limits enforced (CPU, memory)
- Automatic cleanup on expiry

### Privileged Mode

Runner requires privileged mode for Docker-in-Docker:
```yaml
privileged: true
```

**Why it's safe:**
- Runs on dedicated EC2 instance
- Not exposed to internet (behind ALB)
- Backend validates all requests
- Sessions are time-limited

### Docker Socket

Direct Docker socket access is required:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

**Security measures:**
- Only backend can access runner
- Session IDs are validated
- Commands are sanitized
- Containers have resource limits

---

## Monitoring

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "active_sessions": 2,
  "docker_available": true
}
```

### Metrics

- Active session count
- Docker daemon status
- Container resource usage
- Session creation/cleanup rate

---

## Troubleshooting

### Docker daemon not available
```bash
# Check Docker is running
docker ps

# Check socket permissions
ls -la /var/run/docker.sock

# Restart Docker
sudo systemctl restart docker
```

### Session container won't start
```bash
# Check available resources
docker stats

# Check Docker logs
docker logs sess-{session_id}

# Manually remove stuck container
docker rm -f sess-{session_id}
```

### Out of memory
```bash
# Check memory usage
free -h

# Check container limits
docker inspect sess-{session_id} | grep -i memory

# Clean up old containers
docker container prune -f
```

---

## Production Deployment

### AWS ECS (EC2)

**Requirements:**
- EC2 instance with Docker
- ECS-optimized AMI
- IAM role with ECR permissions
- Security group allowing port 8080

**Task Definition:**
```json
{
  "family": "containrlab-runner",
  "requiresCompatibilities": ["EC2"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "runner",
      "image": "{ecr-url}/containrlab-runner:latest",
      "essential": true,
      "privileged": true,
      "portMappings": [{"hostPort": 8080, "containerPort": 8080}],
      "mountPoints": [
        {
          "sourceVolume": "docker-socket",
          "containerPath": "/var/run/docker.sock"
        }
      ]
    }
  ],
  "volumes": [
    {
      "name": "docker-socket",
      "host": {"sourcePath": "/var/run/docker.sock"}
    }
  ]
}
```

See [Deployment Guide](../docs/DEPLOYMENTS.md) for complete setup.

---

## Related Documentation

- [Architecture](../docs/ARCHITECTURE.md) - System architecture
- [Backend API](../backend/README.md) - Runner client integration
- [Judge System](../judge/README.md) - Judge uses runner for validation
- [Deployment Guide](../docs/DEPLOYMENTS.md) - AWS deployment

---

<div align="center">

**[← Back to Main README](../README.md)** | **[View Architecture →](../docs/ARCHITECTURE.md)**

</div

Rootless Docker-in-Docker image and supervisor tooling for learner sessions.
