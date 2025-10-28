# 📚 ContainrLab Documentation

Complete documentation for ContainrLab - Interactive Docker Learning Platform.

---

## 🚀 Getting Started

New to ContainrLab? Start here:

- **[Quick Start Guide](#quick-start)** - Get up and running in 5 minutes
- **[Local Development](LOCAL_RUNBOOK.md)** - Set up your local environment
- **[GitHub OAuth Setup](CI-CD-SETUP.md#github-oauth-setup)** - Configure authentication

---

## 📖 Core Documentation

### Architecture & Design

| Document | Description |
|----------|-------------|
| [🏗️ System Architecture](ARCHITECTURE.md) | Complete system architecture, components, and data flow |
| [☁️ AWS Infrastructure](ARCHITECTURE.md#infrastructure) | AWS deployment architecture and infrastructure |
| [🔄 CI/CD Pipeline](CI-CD-SETUP.md) | GitHub Actions workflows and deployment |
| [🔒 Security Model](ARCHITECTURE.md#security-model) | Authentication, authorization, and container isolation |

### Setup & Deployment

| Document | Description |
|----------|-------------|
| [💻 Local Development Runbook](LOCAL_RUNBOOK.md) | Complete local setup with Docker Compose |
| [🚀 AWS Deployment Guide](DEPLOYMENTS.md) | Deploy to production on AWS ECS |
| [🔐 CI/CD Setup](CI-CD-SETUP.md) | Configure GitHub Actions for automated deployment |

### Component Documentation

| Component | Documentation | Description |
|-----------|---------------|-------------|
| **Backend** | [backend/README.md](../backend/README.md) | FastAPI API service |
| **Frontend** | [frontend/README.md](../frontend/README.md) | Next.js web application |
| **Runner** | [runner/README.md](../runner/README.md) | Docker-in-Docker service |
| **Judge** | [judge/README.md](../judge/README.md) | Lab validation logic |
| **Labs** | [labs/README.md](../labs/README.md) | Lab content and structure |

---

## 🎓 Lab Documentation

Interactive Docker labs with automated validation:

- **[Lab Catalog](../labs/README.md)** - Overview of all available labs
- **[Lab 1: First Dockerfile](../labs/lab1/)** - Build your first container
- **[Lab 2: Layer Caching](../labs/lab2/)** - Optimize build performance
- **[Lab 3: Multi-stage Builds](../labs/lab3/)** - Create production-ready images

---

## 🛠️ Development Guides

### Local Development

```bash
# Clone repository
git clone https://github.com/sanjayb-28/ContainrLab.git
cd ContainrLab

# Set up secrets
echo "your-github-client-id" > compose/secrets/GITHUB_CLIENT_ID.txt
echo "your-github-client-secret" > compose/secrets/GITHUB_CLIENT_SECRET.txt
echo "your-gemini-api-key" > compose/secrets/GEMINI_API_KEY.txt

# Start services
docker compose -f compose/docker-compose.yml up

# Access app
open http://localhost:3000
```

See [Local Development Runbook](LOCAL_RUNBOOK.md) for detailed instructions.

### AWS Deployment

```bash
# Build and push images
./scripts/build-and-push.sh

# Deploy via GitHub Actions
git push origin main  # Triggers automatic deployment
```

See [AWS Deployment Guide](DEPLOYMENTS.md) for detailed instructions.

---

## 🔧 Configuration

### Environment Variables

**Frontend (Next.js):**
```bash
NEXT_PUBLIC_API_BASE=https://api.containrlab.click
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://app.containrlab.click
```

**Backend (FastAPI):**
```bash
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GEMINI_API_KEY=xxx
RUNNERD_BASE_URL=http://localhost:8080
SESSION_TTL_SECONDS=1800
```

**Runner (Docker-in-Docker):**
```bash
SESSION_TTL_SECONDS=1800
CONTAINER_MEMORY_LIMIT=1536m
CONTAINER_CPU_LIMIT=1
```

### AWS Secrets (SSM Parameter Store)

All production secrets are stored in AWS SSM:
```
/containrlab/GITHUB_CLIENT_ID
/containrlab/GITHUB_CLIENT_SECRET
/containrlab/NEXTAUTH_SECRET
/containrlab/GEMINI_API_KEY
/containrlab/SESSION_TTL_SECONDS
```

---

## 🏗️ Architecture Quick Reference

### System Components

```
User Browser
     ↓ HTTPS
AWS ALB (Load Balancer)
     ↓
┌────────────────┬─────────────────┐
│   Frontend     │    Backend      │
│   (Fargate)    │    (Fargate)    │
│   Next.js      │    FastAPI      │
│   Port 3000    │    Port 8000    │
└────────────────┴────────┬────────┘
                          ↓
                   ┌──────────────┐
                   │    Runner    │
                   │    (EC2)     │
                   │  RunnerD +   │
                   │     DinD     │
                   └──────────────┘
```

See [Architecture Documentation](ARCHITECTURE.md) for detailed diagrams.

### Tech Stack

- **Frontend:** Next.js 14, React 18, TailwindCSS, xterm.js
- **Backend:** FastAPI, Python 3.11, SQLite, Google Gemini AI
- **Infrastructure:** AWS ECS (Fargate + EC2), Docker, GitHub Actions
- **Storage:** SQLite (ephemeral), AWS SSM (secrets), ECR (images)

---

## 🔗 Quick Links

### Live System
- **Production App:** [https://app.containrlab.click](https://app.containrlab.click)
- **API Endpoint:** [https://api.containrlab.click](https://api.containrlab.click)
- **API Health:** [https://api.containrlab.click/healthz](https://api.containrlab.click/healthz)

### Repository
- **GitHub:** [sanjayb-28/ContainrLab](https://github.com/sanjayb-28/ContainrLab)
- **Issues:** [GitHub Issues](https://github.com/sanjayb-28/ContainrLab/issues)
- **CI/CD:** [GitHub Actions](https://github.com/sanjayb-28/ContainrLab/actions)

### External Services
- **GitHub OAuth:** [GitHub Apps](https://github.com/settings/developers)
- **Google Gemini:** [AI Studio](https://makersuite.google.com/app/apikey)
- **AWS Console:** [ECS Services](https://console.aws.amazon.com/ecs)

---

## 📞 Support & Contributing

### Getting Help

- **Documentation Issues:** [File an issue](https://github.com/sanjayb-28/ContainrLab/issues/new)
- **Questions:** [GitHub Discussions](https://github.com/sanjayb-28/ContainrLab/discussions)
- **Bug Reports:** [GitHub Issues](https://github.com/sanjayb-28/ContainrLab/issues)

### Contributing

Contributions welcome! Areas where help is needed:

1. **Documentation:** Improve existing docs, add examples
2. **Labs:** Create new lab content
3. **Features:** Add new functionality
4. **Bug Fixes:** Fix known issues
5. **Testing:** Write tests, improve coverage

See [Contributing Guidelines](../CONTRIBUTING.md) *(coming soon)*.

---

## 📝 Document Index

### Root Documentation
- [README.md](../README.md) - Project overview and quickstart
- [LICENSE](../LICENSE) - MIT License
- [SECURITY.md](../SECURITY.md) - Security policy and reporting

### Documentation Folder (docs/)
- [README.md](README.md) - This file (documentation index)
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [LOCAL_RUNBOOK.md](LOCAL_RUNBOOK.md) - Local development guide
- [DEPLOYMENTS.md](DEPLOYMENTS.md) - AWS deployment guide
- [CI-CD-SETUP.md](CI-CD-SETUP.md) - CI/CD configuration

### Component Documentation
- [backend/README.md](../backend/README.md) - Backend API documentation
- [frontend/README.md](../frontend/README.md) - Frontend application
- [runner/README.md](../runner/README.md) - Runner service
- [judge/README.md](../judge/README.md) - Judge logic
- [labs/README.md](../labs/README.md) - Lab catalog

### Lab Content
- [labs/lab1/](../labs/lab1/) - First Dockerfile
- [labs/lab2/](../labs/lab2/) - Layer Caching
- [labs/lab3/](../labs/lab3/) - Multi-stage Builds

---

<div align="center">

**[← Back to Main README](../README.md)** | **[View Architecture →](ARCHITECTURE.md)**

 Made with ❤️ for Docker learners

</div
