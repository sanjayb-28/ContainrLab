# 🤝 Contributing to ContainrLab

Thank you for your interest in contributing to ContainrLab! We welcome contributions from everyone, whether you're fixing bugs, adding features, creating labs, or improving documentation.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Code Guidelines](#code-guidelines)
- [Creating New Labs](#creating-new-labs)
- [Pull Request Process](#pull-request-process)
- [Community Guidelines](#community-guidelines)

---

## Getting Started

Before contributing, please:

1. ✅ **Read the [README](README.md)** - Understand the project goals
2. ✅ **Check [Issues](https://github.com/sanjayb-28/ContainrLab/issues)** - See what needs help
3. ✅ **Join [Discussions](https://github.com/sanjayb-28/ContainrLab/discussions)** - Ask questions
4. ✅ **Review [Architecture](docs/ARCHITECTURE.md)** - Understand the system

---

## Development Setup

### Prerequisites

- Docker Desktop
- Node.js 20+
- Python 3.11+
- Git

### Local Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/ContainrLab.git
cd ContainrLab

# Set up environment
cp .env.example .env  # Edit with your values

# Set up secrets for local development
mkdir -p compose/secrets
echo "your-github-client-id" > compose/secrets/GITHUB_CLIENT_ID.txt
echo "your-github-client-secret" > compose/secrets/GITHUB_CLIENT_SECRET.txt
echo "your-gemini-api-key" > compose/secrets/GEMINI_API_KEY.txt  # Optional

# Start services
docker compose -f compose/docker-compose.yml up

# Access at http://localhost:3000
```

**[→ Full local setup guide](docs/LOCAL_SETUP.md)**

---

## How to Contribute

### 🐛 Report Bugs

Found a bug? [Create an issue](https://github.com/sanjayb-28/ContainrLab/issues/new) with:

- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, browser, Docker version)

### ✨ Suggest Features

Have an idea? [Start a discussion](https://github.com/sanjayb-28/ContainrLab/discussions/new) to:

- Describe the problem it solves
- Explain your proposed solution
- Discuss alternative approaches
- Get community feedback

### 📚 Create Labs

New Docker labs are always welcome! See [Creating New Labs](#creating-new-labs) below.

### 🔧 Fix Issues

1. **Find an issue** - Look for `good first issue` or `help wanted` labels
2. **Comment** - Let us know you're working on it
3. **Fork & Branch** - Create a feature branch
4. **Code** - Follow our [Code Guidelines](#code-guidelines)
5. **Test** - Ensure all tests pass
6. **Submit PR** - Follow the [PR Process](#pull-request-process)

---

## Code Guidelines

### General Principles

- ✅ **Write clean, readable code** - Others will maintain it
- ✅ **Follow existing patterns** - Match the codebase style
- ✅ **Keep changes focused** - One feature/fix per PR
- ✅ **Test your changes** - Don't break existing functionality
- ✅ **Document complex logic** - Help future contributors

### Python (Backend/Runner)

```python
# Follow PEP 8
# Use type hints
# Write docstrings for functions

def create_session(user_id: str, lab_id: str) -> dict:
    """
    Create a new lab session for a user.
    
    Args:
        user_id: Unique identifier for the user
        lab_id: Identifier for the lab to start
        
    Returns:
        Session details including container ID and connection info
    """
    # Implementation...
```

### TypeScript/JavaScript (Frontend)

```typescript
// Use TypeScript for type safety
// Follow Next.js conventions
// Use functional components with hooks

interface SessionProps {
  sessionId: string;
  labId: string;
}

export default function Session({ sessionId, labId }: SessionProps) {
  // Implementation...
}
```

### Docker

```dockerfile
# Use specific image versions (not :latest in production)
# Order layers for optimal caching
# Minimize image size
# Add security best practices

FROM node:20-alpine AS base

# Install dependencies first (cached)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code last (changes frequently)
COPY . .
```

---

## Creating New Labs

Labs are the core learning content. Here's how to create one:

### Lab Structure

```
labs/
└── lab4/                        # New lab directory
    ├── metadata.json            # Lab configuration
    ├── instructions.md          # Student-facing instructions
    ├── workspace/               # Starter files for students
    │   ├── app.py
    │   └── Dockerfile.starter
    ├── solution/                # Reference solution
    │   └── Dockerfile
    └── judge/                   # Validation tests
        └── judge.py
```

### 1. Create metadata.json

```json
{
  "id": "lab4",
  "title": "Your Lab Title",
  "difficulty": "intermediate",
  "description": "Brief description of what students will learn",
  "learning_objectives": [
    "Understand X concept",
    "Apply Y technique",
    "Build Z from scratch"
  ],
  "prerequisites": ["lab1", "lab2"],
  "estimated_time_minutes": 30,
  "tags": ["docker", "optimization", "security"]
}
```

### 2. Write instructions.md

```markdown
# Lab 4: Your Lab Title

## Learning Objectives
- Learn concept A
- Practice skill B
- Build feature C

## Background
Explain the Docker concept you're teaching...

## Requirements
Your Dockerfile must:
- [ ] Use Alpine Linux as base image
- [ ] Install Python 3.11
- [ ] Copy application files
- [ ] Expose port 8000
- [ ] Set proper CMD

## Getting Started
1. Review the starter files in `/workspace`
2. Edit the Dockerfile
3. Click "Submit" to validate

## Hints
- Use multi-stage builds for smaller images
- Order layers by change frequency
```

### 3. Create Workspace

Provide starter files students will edit:

```
workspace/
├── app.py              # Application code
├── requirements.txt    # Dependencies
└── Dockerfile.starter  # Template to complete
```

### 4. Provide Reference Solution

```dockerfile
# solution/Dockerfile
FROM python:3.11-alpine

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 8000

CMD ["python", "app.py"]
```

### 5. Write Judge Tests

```python
# judge/judge.py
"""
Automated validation for Lab 4
"""

def validate_dockerfile(dockerfile_path: str) -> dict:
    """
    Validate student's Dockerfile meets requirements.
    
    Returns:
        {
            "passed": bool,
            "score": int,
            "feedback": [str],
            "errors": [str]
        }
    """
    feedback = []
    errors = []
    score = 0
    
    with open(dockerfile_path) as f:
        content = f.read()
    
    # Check base image
    if "FROM python:3.11-alpine" in content:
        feedback.append("✅ Correct base image")
        score += 20
    else:
        errors.append("❌ Must use python:3.11-alpine as base image")
    
    # Check WORKDIR
    if "WORKDIR" in content:
        feedback.append("✅ WORKDIR set")
        score += 20
    else:
        errors.append("❌ Missing WORKDIR instruction")
    
    # Add more checks...
    
    return {
        "passed": len(errors) == 0 and score >= 80,
        "score": score,
        "feedback": feedback,
        "errors": errors
    }
```

### 6. Test Your Lab

```bash
# Start a local session
docker compose -f compose/docker-compose.yml up

# Navigate to your lab
# Complete it as a student would
# Verify judge validation works correctly
# Check AI hints are helpful
```

### 7. Submit Your Lab

1. Create PR with your lab
2. Include screenshots
3. Explain learning objectives
4. Link to any reference materials

---

## Pull Request Process

### Before Submitting

- [ ] ✅ Code follows style guidelines
- [ ] ✅ All tests pass locally
- [ ] ✅ No console errors/warnings
- [ ] ✅ Documentation updated if needed
- [ ] ✅ Commit messages are clear

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] New lab
- [ ] Documentation update
- [ ] Performance improvement

## Testing
How did you test this?

## Screenshots
If applicable, add screenshots

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes
```

### Review Process

1. **Automated checks** - CI/CD runs tests
2. **Code review** - Maintainer reviews code
3. **Feedback** - Address any requested changes
4. **Approval** - Once approved, we'll merge
5. **Deployment** - Auto-deploys to production

---

## Community Guidelines

### Code of Conduct

- ✅ **Be respectful** - Treat everyone with kindness
- ✅ **Be constructive** - Provide helpful feedback
- ✅ **Be patient** - We're all learning
- ✅ **Be collaborative** - Work together
- ❌ **No harassment** - Zero tolerance
- ❌ **No spam** - Keep discussions relevant

### Communication

- 💬 **GitHub Discussions** - Questions, ideas, help
- 🐛 **GitHub Issues** - Bug reports, feature requests
- 📧 **Email** - sanjay.baskaran@colorado.edu for private matters

### Recognition

Contributors are recognized in:
- Commit history
- Release notes
- Project README (for significant contributions)

---

## Development Workflow

### Branch Naming

```
feature/add-lab5         # New feature
fix/terminal-bug         # Bug fix
docs/update-readme       # Documentation
refactor/api-endpoints   # Code refactoring
```

### Commit Messages

```bash
# Good commit messages
git commit -m "Add Lab 5: Container Networking"
git commit -m "Fix terminal disconnection on idle timeout"
git commit -m "Update deployment docs with new EC2 config"

# Bad commit messages
git commit -m "updates"
git commit -m "fix"
git commit -m "wip"
```

### Testing Locally

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# Integration tests (not yet implemented)
# Will be added in future releases
```

---

## Questions?

- 📖 **Documentation** - Check [docs/](docs/)
- 💬 **Discussions** - [GitHub Discussions](https://github.com/sanjayb-28/ContainrLab/discussions)
- 🐛 **Issues** - [GitHub Issues](https://github.com/sanjayb-28/ContainrLab/issues)
- 📧 **Email** - sanjay.baskaran@colorado.edu

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

<div align="center">

**Thank you for contributing to ContainrLab! 🎉**

Made with ❤️ by our amazing contributors

</div>
