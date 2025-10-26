# Starter Workspace

This workspace already has a functioning FastAPI app. Your job is to tune the Dockerfile so dependency installs are cached.

- Keep `app.py` and `requirements.txt` as-is unless you want to experiment. The judge only cares about the Docker image layout.
- Edit the Dockerfile so:
  1. `requirements.txt` is copied on its own layer.
  2. Dependencies are installed with a single `RUN pip install --no-cache-dir -r requirements.txt`.
  3. `COPY . .` happens **after** the install layer, so edits to `app.py` don’t invalidate the cache.
- Rebuild twice from this directory and confirm the second build reports `Using cache` for the dependency layer.

When you can rebuild quickly and the container still responds on `/health`, you’re ready to run the judge.
