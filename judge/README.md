# Judge System

Automated lab validation system for ContainrLab.

---

## Overview

The Judge system validates user submissions by:
- Checking Dockerfile structure
- Building Docker images
- Running containers and testing functionality
- Providing detailed feedback

---

## Lab Judges

### Lab 1: First Dockerfile
**Checks:**
- `.dockerignore` exists with required patterns
- Dockerfile builds successfully
- Container starts and runs
- Health endpoint responds on port 8080

### Lab 2: Layer Caching
**Checks:**
- Correct instruction order in Dockerfile
- `requirements.txt` copied before source code
- Uses `--no-cache-dir` flag with pip
- Build completes successfully

### Lab 3: Multi-stage Builds
**Checks:**
- Multi-stage Dockerfile (2+ FROM statements)
- Builder stage has alias
- Runtime stage uses `COPY --from=builder`
- Final image size < 250MB
- Container runs with working health endpoint

---

## JudgeResult Model

```python
from judge import JudgeResult

result = JudgeResult(passed=True)

# Add failure
result.add_failure(
    code="docker_build_failed",
    message="Docker build failed inside the runner.",
    hint="Check your Dockerfile syntax."
)

# Add metrics
result.metrics["build"] = {"elapsed_seconds": 12.5}
result.metrics["image_size_mb"] = 185.2
```

**Fields:**
- `passed` (bool) - Overall pass/fail status
- `failures` (list) - List of failures with code/message/hint
- `metrics` (dict) - Performance metrics
- `notes` (dict) - Additional context (logs, warnings)

---

## Adding New Labs

### 1. Create Judge Module

Create `labs/lab4.py`:
```python
from judge.models import JudgeResult

async def evaluate(session_id: str, runner) -> JudgeResult:
    result = JudgeResult(passed=True)
    
    # Your validation logic here
    
    return result
```

### 2. Register Judge

Add to `labs/__init__.py`:
```python
from .lab4 import evaluate as evaluate_lab4
```

### 3. Register in Backend

Add to `backend/app/services/judge_service.py`:
```python
from judge.labs import evaluate_lab4

self._handlers = {
    "lab4": evaluate_lab4,
}
```

---

## Testing

```bash
# Run judge tests
cd backend
pytest tests/test_judge_*.py -v

# Test specific lab
pytest tests/test_judge_lab1.py -v
```

---

## Related Documentation

- [Lab Catalog](../labs/README.md) - Lab content
- [Architecture](../docs/ARCHITECTURE.md) - System design
- [Backend API](../backend/README.md) - Judge service integration
