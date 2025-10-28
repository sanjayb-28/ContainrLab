# Lab 1 · First Dockerfile

You’re building a tiny web service that says “ok” at `http://localhost:8080/health`. The judge will build your Docker image, run it, and make that request. If it receives HTTP 200, you pass.

## What to create

1. **`app.py`** – a Python web app (FastAPI is recommended) with a single route `/health` that returns 200 and a simple JSON body (for example `{ "ok": true }`). Make sure the app listens on `0.0.0.0` so it’s reachable from outside the container.
2. **`requirements.txt`** – list every Python package your app needs (e.g. `fastapi`, `uvicorn`). Docker will install from this file.
3. **`.dockerignore`** – keep bulky folders (virtual environments like `venv/`, Python cache files like `__pycache__/`, `.git`, etc.) out of the build context so your image builds quickly.
4. **`Dockerfile`** – base on a lightweight Python image, copy `requirements.txt`, install dependencies, then copy the rest of the source and start the server on port 8080 when the container runs.

## Suggested workflow

- Sketch the workspace: keep the four files above at the top level of `/workspace`.
- Implement `/health` first and test it with a plain `uvicorn` run on your machine.
- Add dependencies to `requirements.txt` as you import them.
- Write `.dockerignore` before building so you don’t accidentally ship virtualenvs or build artefacts.
- In the Dockerfile, place `COPY requirements.txt .` and `RUN pip install ...` before `COPY . .` so Docker can cache the install layer.
- After building, run the container, curl the health endpoint, and stop/remove the container so the judge can reuse the port.

## Self-check before submitting

- Does `docker build -t lab1-solution .` finish successfully?
- When you run `docker run -d --name lab1-app -p 8080:8080 lab1-solution`, does `curl http://localhost:8080/health` print a JSON payload with `"ok": true`?
- Can you stop the container cleanly with `docker stop lab1-app && docker rm lab1-app`?

If you can answer “yes” to all of these, the judge will be happy. For a fully worked example (including sample code), view the solution below.
