# Starter Workspace

This directory is mounted into your runner container as `/workspace`. To pass Lab 1 you must:

- Add `app.py` that serves `GET /health` and returns HTTP 200.<br />
  _Tip: the FastAPI snippet in `../README.md` is a good starting point._
- List the app’s dependencies in `requirements.txt`.
- Create `.dockerignore` and exclude `venv/`, `node_modules/`, build outputs, etc., so Docker only uploads what it needs.
- Write a Dockerfile that:
  1. copies `requirements.txt` and installs dependencies **before** copying everything else, and
  2. starts the app on `0.0.0.0:8080`.

Once those files are in place, build and run the image from the terminal in this workspace and ensure `curl http://localhost:8080/health` returns `{"ok": true}`. The judge performs the same steps automatically.
