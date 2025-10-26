# Lab 2 · Reference Solution (Explained)

The starter app already works; we just need to reorganise the Dockerfile to make layer caching shine.

## File layout

```
/workspace
├── app.py
├── requirements.txt
├── .dockerignore
└── Dockerfile
```

## Dockerfile – cache-aware ordering

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 1. Prime the dependency cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Copy the remainder of the source only after deps are installed
COPY . .

CMD ["python", "app.py"]
```

Why it works:
- Copying only `requirements.txt` keeps the dependency layer unchanged unless the requirements change, so subsequent builds reuse it instantly.
- `pip install` lives in a single `RUN`, producing one cacheable layer.
- Application code is copied afterwards; changing `app.py` no longer invalidates the dependency layer.

## requirements.txt (unchanged)

```
fastapi==0.115.0
uvicorn==0.31.0
```

## .dockerignore – optional but recommended

```
__pycache__/
*.pyc
venv/
.idea/
.git/
```

It keeps stray files out of the build context so the cache key only depends on files you actually need.

## Verify the cache locally

```bash
# First build populates the cache
$ docker build -t lab2-cache .

# Second build should report `Using cache` for the dependency layer
$ docker build -t lab2-cache .

# Run the container and hit the health endpoint
$ docker run --rm -p 8080:8080 lab2-cache
$ curl http://localhost:8080/health
Hello from Lab 2!
```

If the second build still rebuilds dependencies, double-check the order of your `COPY` instructions or ensure no stray files (like `pip` logs) invalidate the layer.
