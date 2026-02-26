# Lab Catalog

Progressive Docker curriculum with hands-on exercises and automated validation.

---

## Available Labs

### Lab 1: First Dockerfile

**Difficulty:** Beginner | **Duration:** 20-30 minutes

**Topics:** Docker basics, Dockerfiles, .dockerignore, health checks

**Learning Objectives:**
- Write your first Dockerfile
- Optimize build context with .dockerignore
- Implement container health checks
- Build and run containers

**Requirements:**
- `app.py` with `/health` endpoint
- `requirements.txt` for dependencies
- `.dockerignore` with Python patterns
- Dockerfile with proper layer ordering

[📝 View Lab 1 Details](lab1/description.md) | [💡 View Solution](lab1/solution.md)

---

### Lab 2: Layer Caching

**Difficulty:** Intermediate | **Duration:** 15-20 minutes

**Topics:** Build optimization, layer caching, dependency management

**Learning Objectives:**
- Understand Docker layer caching mechanisms
- Optimize Dockerfile instruction order
- Reduce build times through cache reuse
- Apply best practices for dependency installation

**Requirements:**
- Copy `requirements.txt` before source code
- Install dependencies before copying application
- Use `--no-cache-dir` flag with pip
- Demonstrate cache effectiveness

[📝 View Lab 2 Details](lab2/description.md) | [💡 View Solution](lab2/solution.md)

---

### Lab 3: Multi-stage Builds

**Difficulty:** Advanced | **Duration:** 30-40 minutes

**Topics:** Multi-stage builds, image optimization, production deployments

**Learning Objectives:**
- Implement multi-stage Dockerfiles
- Separate build and runtime environments
- Reduce final image size significantly
- Build production-ready containers

**Requirements:**
- Builder stage for dependencies
- Minimal runtime stage
- Copy only necessary artifacts
- Final image < 250MB
- Functional health endpoint

[📝 View Lab 3 Details](lab3/description.md) | [💡 View Solution](lab3/solution.md)

---

## Learning Path

**Recommended sequence:** Lab 1 → Lab 2 → Lab 3

Each lab builds on concepts from the previous one. Complete them in order for the best learning experience.

---

## How It Works

**1. Start Session** - Click "Start Session" to get an isolated Docker-in-Docker environment with terminal and editor (45-minute session)

**2. Complete Lab** - Read requirements, create files in `/workspace`, test your solution, use AI hints if needed

**3. Submit** - Automated judge validates your work and provides instant feedback with specific errors

**4. Review Solution** - After passing, view reference solution with detailed explanations

---

## Automated Validation

**Lab 1:**
- `.dockerignore` with required patterns
- Successful Docker build
- Container runs successfully
- Health endpoint returns HTTP 200

**Lab 2:**
- Correct Dockerfile instruction order
- Dependencies installed before source copy
- `--no-cache-dir` flag used
- Successful build completion

**Lab 3:**
- Multi-stage Dockerfile (2+ stages)
- Builder stage with alias
- `COPY --from=builder` in runtime stage
- Final image < 250MB
- Functional health endpoint

---

## AI Assistant

Google Gemini-powered assistance available for:
- Contextual hints
- Concept explanations
- Error debugging

**Rate limit:** 5 requests/minute per session

---

## Lab Structure

Each lab contains:
- `description.md` - Requirements and learning objectives
- `solution.md` - Reference solution with explanations
- `starter/` - Starter files (if provided)

---

## For Contributors

**Adding New Labs:**
1. Create lab folder (`labs/lab4/`)
2. Add `description.md` and `solution.md`
3. Create judge in `judge/labs/lab4.py`
4. Register judge in `judge/labs/__init__.py`
5. Update catalog and test thoroughly

**Judge Requirements:**
- Accept `session_id` and `runner` client
- Return `JudgeResult` with validation feedback
- Provide clear error messages and hints
- Clean up resources after testing

See [`../judge/labs/`](../judge/labs/) for examples.  

---

## Related Documentation

- [System Architecture](../docs/ARCHITECTURE.md)
- [Judge Documentation](../judge/README.md)
- [Runner Service](../runner/README.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

<div align="center">

**[← Back to Main README](../README.md)** | **[View Architecture →](../docs/ARCHITECTURE.md)**

</div
