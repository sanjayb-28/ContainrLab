# 🎓 Lab Catalog

Progressive Docker curriculum with hands-on exercises and automated validation.

---

## 📚 Available Labs

### 🐳 Lab 1: First Dockerfile

**Difficulty:** ⭐ Beginner  
**Duration:** 20-30 minutes  
**Topics:** Docker basics, Dockerfiles, .dockerignore, health checks

**What You'll Learn:**
- Create your first Dockerfile
- Write a basic web service
- Use .dockerignore to optimize build context
- Implement health endpoints
- Build and run containers

**Requirements:**
- Create `app.py` with `/health` endpoint
- Create `requirements.txt` for dependencies
- Create `.dockerignore` with Python-specific patterns
- Create `Dockerfile` with proper layer ordering

[📝 View Lab 1 Details](lab1/description.md) | [💡 View Solution](lab1/solution.md)

---

### ⚡ Lab 2: Layer Caching

**Difficulty:** ⭐⭐ Intermediate  
**Duration:** 15-20 minutes  
**Topics:** Build optimization, Docker layer caching, dependency management

**What You'll Learn:**
- Understand Docker layer caching
- Optimize Dockerfile instruction order
- Reduce build times dramatically
- Use `--no-cache-dir` flag for pip
- Verify cache hits with build output

**Requirements:**
- Copy `requirements.txt` before source code
- Install dependencies before copying app code
- Use optimal pip install flags
- Demonstrate cache reuse on rebuild

[📝 View Lab 2 Details](lab2/description.md) | [💡 View Solution](lab2/solution.md)

---

### 🏗️ Lab 3: Multi-stage Builds

**Difficulty:** ⭐⭐⭐ Advanced  
**Duration:** 30-40 minutes  
**Topics:** Multi-stage builds, image size optimization, production deployments

**What You'll Learn:**
- Create multi-stage Dockerfiles
- Separate build and runtime environments
- Dramatically reduce final image size
- Copy only necessary artifacts between stages
- Build production-ready images

**Requirements:**
- Create builder stage for dependencies
- Create runtime stage with minimal base image
- Copy built artifacts from builder stage
- Keep final image under 250MB
- Maintain working health endpoint

[📝 View Lab 3 Details](lab3/description.md) | [💡 View Solution](lab3/solution.md)

---

## 📊 Learning Path

```
Lab 1 (Beginner)
   🐳 First Dockerfile
   ↓
Lab 2 (Intermediate)
   ⚡ Layer Caching
   ↓
Lab 3 (Advanced)
   🏗️ Multi-stage Builds
```

**Recommended Order:**  
Complete labs in sequence (1 → 2 → 3) for the best learning experience. Each lab builds on concepts from the previous one.

---

## 🎯 How Labs Work

### 1. Start Session
- Click "Start Session" on any lab
- System spawns isolated Docker-in-Docker container
- You get a full terminal and file editor
- Session lasts 30 minutes

### 2. Complete Lab
- Read the lab description carefully
- Create required files in `/workspace`
- Use the terminal to test your work
- Get AI hints if you're stuck

### 3. Submit for Judging
- Click "Submit" when ready
- Automated judge validates your solution
- Get instant feedback with specific errors
- Fix issues and resubmit unlimited times

### 4. Learn from Solution
- After passing, view reference solution
- See detailed explanations of concepts
- Understand best practices

---

## ✅ Judge Validation

Each lab has an automated judge that checks:

**Lab 1 Judge:**
- ✅ `.dockerignore` exists with required patterns (`__pycache__`, `venv`)
- ✅ Dockerfile builds successfully
- ✅ Container starts and runs
- ✅ Health endpoint returns HTTP 200
- ✅ Correct response format

**Lab 2 Judge:**
- ✅ Dockerfile has correct instruction order
- ✅ `requirements.txt` copied before source
- ✅ Dependencies installed before `COPY . .`
- ✅ Uses `--no-cache-dir` flag
- ✅ Build completes successfully

**Lab 3 Judge:**
- ✅ Multi-stage Dockerfile (2+ stages)
- ✅ Builder stage has alias
- ✅ Runtime stage uses `COPY --from=builder`
- ✅ Final image size < 250MB
- ✅ Container runs with working health endpoint

---

## 🤖 AI Assistant

Stuck on a lab? Use the AI assistant powered by Google Gemini:

- **Get Hint** - Contextual hint for your current step
- **Explain Concept** - Detailed explanation of Docker concepts
- **Debug Error** - Help understanding error messages

**Rate Limit:** 5 requests per minute per session

---

## 📝 Lab Structure

Each lab folder contains:

```
lab1/
├── description.md       # Lab requirements and learning objectives
├── solution.md          # Reference solution with explanations
└── starter/             # Starter files (if any)
    └── README.md        # Starter workspace info
```

---

## 🛠️ Development

### Adding New Labs

1. Create lab folder: `labs/lab4/`
2. Add `description.md` with requirements
3. Add `solution.md` with reference solution
4. Create judge in `judge/labs/lab4.py`
5. Register judge in `judge/labs/__init__.py`
6. Add lab metadata to catalog
7. Test thoroughly before deploying

### Judge Development

Judges are Python modules that:
- Accept `session_id` and `runner` client
- Return `JudgeResult` with pass/fail and feedback
- Provide helpful error messages and hints
- Clean up containers after testing

See existing judges in [`../judge/labs/`](../judge/labs/) for examples.

---

## 📊 Lab Statistics

**Current Labs:** 3  
**Total Concepts:** 15+  
**Average Completion Time:** 65-90 minutes (all labs)  
**Difficulty Range:** Beginner to Advanced  

---

## 🔗 Related Documentation

- [🏗️ System Architecture](../docs/ARCHITECTURE.md)
- [⚖️ Judge Documentation](../judge/README.md)
- [🔧 Runner Service](../runner/README.md)
- [📚 Full Documentation](../docs/README.md)

---

## 💬 Feedback & Contributions

Have ideas for new labs? Found an issue? 

- [Open an Issue](https://github.com/sanjayb-28/ContainrLab/issues/new)
- [Start a Discussion](https://github.com/sanjayb-28/ContainrLab/discussions)
- Contribute new lab content (see [Contributing Guidelines](../CONTRIBUTING.md))

---

<div align="center">

**[← Back to Main README](../README.md)** | **[View Architecture →](../docs/ARCHITECTURE.md)**

Happy Docker Learning! 🐳

</div
