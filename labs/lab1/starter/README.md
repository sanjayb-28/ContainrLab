# Lab 1 Starter Workspace

This workspace is intentionally empty. You will create all required files from scratch.

## Files to Create

For Lab 1, you need to create:
- `Dockerfile` - Container definition
- `app.py` - Python web service with `/health` endpoint
- `requirements.txt` - Python dependencies
- `.dockerignore` - Build context optimization

## Getting Started

When you start a lab session, this workspace is copied to `/workspace` in your isolated container.

**See:** [Lab 1 Description](../description.md) for detailed requirements.

- List the app’s dependencies in `requirements.txt`.
- Create `.dockerignore` and exclude `venv/`, `node_modules/`, build outputs, etc., so Docker only uploads what it needs.
- Write a Dockerfile that:
  1. copies `requirements.txt` and installs dependencies **before** copying everything else, and
  2. starts the app on `0.0.0.0:8080`.

Once those files are in place, build and run the image from the terminal in this workspace and ensure `curl http://localhost:8080/health` returns `{"ok": true}`. The judge performs the same steps automatically.
