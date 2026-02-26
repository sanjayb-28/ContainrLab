# ContainrLab Documentation

Complete documentation for ContainrLab. Whether you're learning Docker, deploying to AWS, or contributing code, you'll find everything you need here.

---

## Getting Started

<table>
<tr>
<td width="50%">

### New Users
Start here if you're new to ContainrLab:

1. **[Try the Live Demo](https://app.containrlab.click)** - No setup required
2. **[Browse the Labs](../labs/)** - See what you'll learn
3. **[View Quick Start](../README.md#-quick-start)** - Get started in minutes

</td>
<td width="50%">

### Developers
Contributing or running locally:

1. **[Local Setup Guide](LOCAL_SETUP.md)** - Run on your machine
2. **[Architecture Overview](ARCHITECTURE.md)** - How it works
3. **[Component Docs](#-component-documentation)** - Backend, Frontend, etc.

</td>
</tr>
</table>

---

## Documentation by Purpose

### For Learners

Learn Docker through hands-on practice:

| Document | Description |
|----------|-------------|
| **[Lab Catalog](../labs/)** | Browse all available labs with difficulty levels |
| **[Lab 1: First Dockerfile](../labs/lab1/)** | Create your first container (Beginner) |
| **[Lab 2: Layer Caching](../labs/lab2/)** | Optimize builds (Intermediate) |
| **[Lab 3: Multi-stage Builds](../labs/lab3/)** | Production-ready images (Advanced) |

---

### Understanding the System

Deep dive into how ContainrLab works:

| Document | Description |
|----------|-------------|
| **[System Architecture](ARCHITECTURE.md)** | Complete system design, components, and diagrams |

---

### Deployment

Deploy your own instance to production:

| Document | Description |
|----------|-------------|
| **[Deployment Guide](DEPLOYMENT.md)** | Complete AWS deployment with CI/CD and secrets |

---

### Development

Build and contribute to ContainrLab:

| Document | Description |
|----------|-------------|
| **[Local Setup](LOCAL_SETUP.md)** | Complete local development environment |
| **[Backend](../backend/README.md)** | FastAPI service documentation |
| **[Frontend](../frontend/README.md)** | Next.js application documentation |
| **[Runner](../runner/README.md)** | Docker-in-Docker service |
| **[Judge](../judge/README.md)** | Lab validation system |

---

## Documentation Structure

```
docs/
├── README.md (you are here)          # Documentation hub
├── ARCHITECTURE.md                   # System design + diagrams
├── DEPLOYMENT.md                     # AWS deployment + CI/CD + secrets
└── LOCAL_SETUP.md                    # Local development setup
```

---

## Quick Reference

### Production URLs

- **Production:** [https://app.containrlab.click](https://app.containrlab.click)
- **API:** [https://api.containrlab.click](https://api.containrlab.click)
- **Health Check:** [https://api.containrlab.click/healthz](https://api.containrlab.click/healthz)

### Key Specifications

| Aspect | Details |
|--------|---------|
| **Architecture** | ECS Fargate (API/Web) + ECS on EC2 (Runner) |
| **Session TTL** | 45 minutes |
| **Database** | SQLite (ephemeral) |

### Environment Variables

**Backend (FastAPI):**
```bash
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GEMINI_API_KEY=xxx
RUNNERD_BASE_URL=http://runner:8080
SESSION_TTL_SECONDS=2700
SESSION_CLEANUP_INTERVAL_SECONDS=60
```

**Frontend (Next.js):**
```bash
NEXT_PUBLIC_API_BASE=https://api.containrlab.click
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://app.containrlab.click
```

**[View complete deployment guide →](DEPLOYMENT.md)**

---

## Architecture Overview

### System Components

```
User Browser
     ↓
Frontend (Next.js)
     ↓
Backend (FastAPI) ←→ GitHub OAuth
     ↓              ↘
Runner (DinD)        Gemini AI
     ↓
Session Containers
```

**[View detailed architecture →](ARCHITECTURE.md)**

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14, React 18, TailwindCSS, xterm.js, NextAuth |
| **Backend** | FastAPI, Python 3.12, SQLite, Google Gemini AI |
| **Infrastructure** | AWS ECS (Fargate + EC2), Docker, GitHub Actions, ECR, SSM |
| **External** | GitHub OAuth, Google Gemini AI |

**[View complete architecture →](ARCHITECTURE.md)**

---

## Component Documentation

### Core Services

| Component | README | Description |
|-----------|--------|-------------|
| **Backend** | [backend/README.md](../backend/README.md) | FastAPI API service with WebSocket support |
| **Frontend** | [frontend/README.md](../frontend/README.md) | Next.js web application with terminal UI |
| **Runner** | [runner/README.md](../runner/README.md) | Docker-in-Docker session management |
| **Judge** | [judge/README.md](../judge/README.md) | Automated lab validation system |

### Supporting Components

| Component | README | Description |
|-----------|--------|-------------|
| **Infrastructure** | [infra/](../infra/) | AWS configuration files |
| **Labs** | [labs/README.md](../labs/README.md) | Lab content and structure |

---

## Find What You Need

### I want to...

- **Learn Docker** → [Browse Labs](../labs/)
- **Try it out** → [Live Demo](https://app.containrlab.click)
- **Run locally** → [Local Setup](LOCAL_SETUP.md)
- **Deploy to AWS** → [Deployment Guide](DEPLOYMENT.md)
- **Understand how it works** → [Architecture](ARCHITECTURE.md)
- **Contribute code** → [Local Setup](LOCAL_SETUP.md) + [Component Docs](#component-documentation)
- **Set up CI/CD** → [Deployment Guide](DEPLOYMENT.md#option-1-automated-cicd-deployment-recommended)
- **Manage secrets** → [Deployment Guide](DEPLOYMENT.md#secrets-management)
- **Troubleshoot** → Check relevant component README

---

## Getting Help

### Documentation Issues

Found something unclear or outdated?

- **[File an Issue](https://github.com/sanjayb-28/ContainrLab/issues/new)** - Report documentation problems
- **[Start a Discussion](https://github.com/sanjayb-28/ContainrLab/discussions)** - Ask questions

### Technical Support

- **Bug Reports:** [GitHub Issues](https://github.com/sanjayb-28/ContainrLab/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/sanjayb-28/ContainrLab/discussions)
- **Email:** support@containrlab.click *(configure if needed)*

---

## Contributing

We welcome contributions to documentation!

**How to contribute:**
1. Fork the repository
2. Make your changes to relevant docs
3. Test that all links work
4. Submit a pull request

**Documentation guidelines:**
- Keep it concise and clear
- Link to details instead of duplicating
- Use consistent formatting
- Test all code examples

**[View Contributing Guide →](../CONTRIBUTING.md)**

---

## Documentation Index

### Root Documentation
- [Main README](../README.md) - Project overview and quick start
- [LICENSE](../LICENSE) - MIT License
- [SECURITY.md](../SECURITY.md) - Security policy

### Core Documentation (docs/)
- [README.md](README.md) - This file (documentation hub)
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture, design, and diagrams
- [DEPLOYMENT.md](DEPLOYMENT.md) - AWS deployment, CI/CD, and secrets
- [LOCAL_SETUP.md](LOCAL_SETUP.md) - Local development guide

### Component Documentation
- [backend/README.md](../backend/README.md) - Backend API service
- [frontend/README.md](../frontend/README.md) - Frontend application
- [runner/README.md](../runner/README.md) - Runner service
- [judge/README.md](../judge/README.md) - Judge system

### Lab Content
- [labs/README.md](../labs/README.md) - Lab catalog
- [labs/lab1/](../labs/lab1/) - First Dockerfile
- [labs/lab2/](../labs/lab2/) - Layer Caching
- [labs/lab3/](../labs/lab3/) - Multi-stage Builds

---

<div align="center">

**[← Back to Main README](../README.md)** | **[View Architecture →](ARCHITECTURE.md)** | **[Deploy to AWS →](DEPLOYMENT.md)**

Built for Docker learners

</div>
