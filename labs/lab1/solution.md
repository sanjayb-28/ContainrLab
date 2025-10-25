# Lab 1 · Reference Solution (Explained)

Below is one possible implementation that passes the judge, along with notes explaining why each file matters. Feel free to adapt it to your own style.

## File layout

```
/workspace
├── app.py
├── requirements.txt
├── .dockerignore
└── Dockerfile
```

## app.py – the web service

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}
```

- **FastAPI** gives us a tiny HTTP server with almost no setup.
- The route `/health` returns a plain dictionary. FastAPI automatically turns it into JSON (`{"ok": true}`) and responds with HTTP status 200.
- Returning 200 is critical—the judge checks for that exact status code.

## requirements.txt – runtime dependencies

```
fastapi==0.115.0
uvicorn==0.31.0
```

- `fastapi` is needed at runtime to handle requests.
- `uvicorn` is the ASGI server that actually runs the app inside the container.
- Pinning versions keeps builds reproducible.

## .dockerignore – smaller build context

```
__pycache__/
*.pyc
venv/
node_modules/
.env
.git/
```

- Docker copies the entire build context into the image. Ignoring caches, virtual environments, and git history keeps the context small and makes rebuilds faster.
- Add any other directories you don’t want in the image (tests, documentation, etc.).

## Dockerfile – build and run the image

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first so Docker can reuse this layer between builds
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Now add the actual application code
COPY . .

# Start the FastAPI app on port 8080 (required by the judge)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
```

Key ideas:
- The `WORKDIR` keeps the following commands tidy.
- Copying `requirements.txt` and installing packages **before** copying the rest of the source lets Docker cache the expensive install layer. When you change your app code but not dependencies, rebuilds are much faster.
- `CMD` runs the app with uvicorn, binding to `0.0.0.0` so requests from outside the container reach it.

## Test the image

```bash
# Build the image
$ docker build -t lab1-solution .

# Run the container in the background
$ docker run -d --name lab1-app -p 8080:8080 lab1-solution

# Exercise the health endpoint
$ curl http://localhost:8080/health
{"ok":true}

# Stop and remove the container when finished
$ docker stop lab1-app && docker rm lab1-app
```

What to watch for:
- `docker build` should complete without errors.
- The curl command must return HTTP 200 and the JSON payload above. If you see a different status code or an exception traceback, fix the app before submitting.
- Stopping and removing the container keeps the port available for the judge.

Once these checks pass locally, the automated judge will follow the same sequence and report success.
