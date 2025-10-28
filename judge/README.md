# ⚖️ Judge System

Automated lab validation system for ContainrLab.

---

## Overview

The Judge system validates user submissions for Docker labs by:
- Checking Dockerfile structure and correctness
- Building Docker images
- Running containers and testing functionality
- Providing detailed feedback and hints

---

## Architecture

```
User submits lab
       ↓
Backend calls JudgeService.evaluate()
       ↓
Lab-specific judge module (lab1.py, lab2.py, lab3.py)
       ↓
┌─────────────────────────────────────┐
│ 1. Read files (Dockerfile, .dockerignore) │
│ 2. Validate structure                   │
│ 3. Build image via runner              │
│ 4. Run container                        │
│ 5. Test functionality                   │
│ 6. Check size/performance (if needed)   │
└─────────────────────────────────────┘
       ↓
Return JudgeResult (passed, failures, metrics)
       ↓
Frontend displays results to user
```

---

## Directory Structure

```
judge/
├── __init__.py          # Judge exports
├── models.py            # JudgeResult model
├── labs/                # Lab-specific judges
│   ├── __init__.py      # Export evaluate functions
│   ├── lab1.py          # Lab 1: First Dockerfile
│   ├── lab2.py          # Lab 2: Layer Caching
│   └── lab3.py          # Lab 3: Multi-stage Builds
└── README.md            # This file
```

---

## Lab Judges

### Lab 1: First Dockerfile
**File:** `labs/lab1.py`

**Checks:**
- ✅ `.dockerignore` exists with required patterns (`__pycache__`, `venv`)
- ✅ Dockerfile builds successfully
- ✅ Container starts and runs
- ✅ Health endpoint at `/health` returns HTTP 200
- ✅ Response format is valid JSON

**Key Functions:**
- `_read_dockerignore()` - Read and validate .dockerignore
- `_validate_dockerignore()` - Check required patterns
- `_attempt_build()` - Build Docker image
- `_exercise_container()` - Run and test container
- `_probe_health()` - Health check with retries

---

### Lab 2: Layer Caching
**File:** `labs/lab2.py`

**Checks:**
- ✅ Dockerfile has correct instruction order
- ✅ `requirements.txt` copied before source code
- ✅ Dependencies installed before `COPY . .`
- ✅ Uses `--no-cache-dir` flag with pip
- ✅ Build completes successfully

**Key Functions:**
- `_read_dockerfile()` - Read Dockerfile contents
- `_validate_dockerfile_order()` - Check instruction sequence
- `_validate_pip_flags()` - Verify optimization flags
- `_attempt_build()` - Build and capture metrics

---

### Lab 3: Multi-stage Builds
**File:** `labs/lab3.py`

**Checks:**
- ✅ Multi-stage Dockerfile (2+ FROM statements)
- ✅ Builder stage has alias (AS builder)
- ✅ Runtime stage uses `COPY --from=builder`
- ✅ Final image size < 250MB
- ✅ Container runs with working health endpoint

**Key Functions:**
- `_validate_multistage()` - Check multi-stage structure
- `_extract_alias()` - Extract stage alias
- `_has_copy_from()` - Verify artifact copying
- `_attempt_build()` - Build and measure image size
- `_exercise_container()` - Test final image

---

## JudgeResult Model

```python
from judge import JudgeResult

result = JudgeResult(passed=True)

# Add failure with code, message, and hint
result.add_failure(
    code="docker_build_failed",
    message="Docker build failed inside the runner.",
    hint="Check your Dockerfile syntax."
)

# Add metrics
result.metrics["build"] = {"elapsed_seconds": 12.5}
result.metrics["image_size_mb"] = 185.2

# Add notes (build logs, etc.)
result.notes["build_logs"] = ["Step 1/5", "..."]

# Check if passed
if result.passed:
    print("Lab completed successfully!")
```

**Fields:**
- `passed` (bool) - Overall pass/fail status
- `failures` (list) - List of failure objects with code/message/hint
- `metrics` (dict) - Performance metrics (time, size, etc.)
- `notes` (dict) - Additional context (logs, warnings)

---

## Runner Integration

Judges interact with the Runner service via the `RunnerClient` interface:

```python
# Build image
build_response = await runner.build(
    session_id=session_id,
    context_path="/workspace",
    dockerfile_path="Dockerfile",
    image_tag="containrlab/lab1-abc123"
)

# Run container
run_response = await runner.run(
    session_id=session_id,
    image=image_tag,
    ports=["8080:8080"],
    detach=True
)

# Execute command
exec_response = await runner.exec(
    session_id=session_id,
    command=["curl", "-s", "http://localhost:8080/health"]
)

# Stop container
await runner.stop_run(
    session_id=session_id,
    container_name=container_name,
    remove=True
)
```

---

## Error Handling

Judges handle various error scenarios:

### Build Failures
```python
try:
    build_response = await runner.build(...)
except httpx.HTTPStatusError as exc:
    detail = exc.response.json()
    result.add_failure(
        code="docker_build_failed",
        message="Docker build failed.",
        hint=detail.get("hint", "Check Dockerfile syntax")
    )
    result.notes["build_logs"] = detail.get("logs", [])
```

### Runtime Failures
```python
if not await _probe_health(session_id, runner):
    result.add_failure(
        code="healthcheck_failed",
        message="Container failed to respond on /health.",
        hint="Ensure app listens on port 8080 and exposes /health."
    )
```

### Cleanup
Always clean up containers, even on failure:
```python
finally:
    if container_name:
        await _safe_stop(session_id, runner, container_name)
```

---

## Adding New Labs

### 1. Create Judge Module

Create `labs/lab4.py`:
```python
from judge.models import JudgeResult
from .lab1 import RunnerProtocol

async def evaluate(session_id: str, runner: RunnerProtocol) -> JudgeResult:
    result = JudgeResult(passed=True)
    
    # Your validation logic here
    
    return result
```

### 2. Register Judge

Add to `labs/__init__.py`:
```python
from .lab4 import evaluate as evaluate_lab4

__all__ = [
    "evaluate_lab1",
    "evaluate_lab2",
    "evaluate_lab3",
    "evaluate_lab4",  # Add new lab
]
```

### 3. Register in Backend

Add to `backend/app/services/judge_service.py`:
```python
from judge.labs import evaluate_lab4

self._handlers: Dict[str, LabHandler] = {
    "lab1": evaluate_lab1,
    "lab2": evaluate_lab2,
    "lab3": evaluate_lab3,
    "lab4": evaluate_lab4,  # Add new lab
}
```

### 4. Add Tests

Create `backend/tests/test_judge_lab4.py`:
```python
import pytest
from judge.labs import evaluate_lab4

@pytest.mark.asyncio
async def test_lab4_success(mock_runner, tmp_path):
    # Test successful submission
    pass

@pytest.mark.asyncio
async def test_lab4_failure(mock_runner, tmp_path):
    # Test failed submission
    pass
```

---

## Testing Judges

### Unit Tests

Run judge tests:
```bash
cd backend
pytest tests/test_judge_lab*.py -v
```

### Manual Testing

1. Start local environment:
   ```bash
   docker compose -f compose/docker-compose.yml up
   ```

2. Create test session and submit lab

3. Check judge output in backend logs

---

## Best Practices

### 1. Provide Helpful Error Messages
✅ **Good:**
```python
result.add_failure(
    code="copy_requirements_missing",
    message="Dockerfile must copy requirements.txt before other files.",
    hint="Add `COPY requirements.txt .` before installing dependencies."
)
```

❌ **Bad:**
```python
result.add_failure(
    code="error",
    message="Something went wrong.",
    hint="Fix it."
)
```

### 2. Always Clean Up Resources
```python
try:
    # Judge logic
    pass
finally:
    # Clean up containers, even on error
    await _safe_stop(session_id, runner, container_name)
```

### 3. Use Specific Failure Codes
- `docker_build_failed`
- `healthcheck_failed`
- `dockerignore_missing`
- `layer_order_incorrect`
- `image_too_large`

### 4. Capture Relevant Logs
```python
result.notes["build_logs"] = build_response.get("logs", [])
result.notes["runtime_logs"] = container_logs
```

---

## Related Documentation

- [Lab Catalog](../labs/README.md) - Lab content and requirements
- [Runner Service](../runner/README.md) - Runner API reference
- [Architecture](../docs/ARCHITECTURE.md) - System architecture
- [Backend API](../backend/README.md) - Judge service integration

---

## Troubleshooting

### Judge times out
- Check runner service is running
- Verify network connectivity to runner
- Check Docker daemon on runner

### False failures
- Review judge logic for edge cases
- Check if test assumptions are correct
- Verify health check probing logic

### Build logs not captured
- Ensure runner returns logs in response
- Check error handling in judge
- Verify notes field is populated

---

<div align="center">

**[← Back to Main README](../README.md)** | **[View Lab Catalog →](../labs/README.md)**

</div

Automated checks and metrics collectors for each lab.
