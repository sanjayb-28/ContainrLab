# Lab 2 · Layer caching superpowers

You already have a working Python app. Now optimise its Dockerfile so dependency layers are cached and rebuilds after code changes are instant. The judge builds your image twice and expects the second build to reuse the dependency layer.

## What to focus on

1. **Cache-friendly Dockerfile**
   - Copy `requirements.txt` (and nothing else) before installing dependencies.
   - Install with `pip install --no-cache-dir -r requirements.txt` in a single `RUN` instruction.
   - Only after the dependencies layer is built should you `COPY . .`.
2. **Lean build context**
   - Add a `.dockerignore` if you introduce additional artefacts—keep caches, virtualenvs, and logs out of the build.
3. **Keep the app behaviour identical**
   - The container must still start with `python app.py` and expose the health endpoint on `0.0.0.0:8080`.

## Suggested workflow

- Inspect the starter Dockerfile. Notice how copying the whole project *before* `pip install` invalidates cache on every file change.
- Reorder the `COPY` instructions so dependency installation happens before app code lands in the image.
- Combine `pip install` into a single `RUN` to avoid multiple layers.
- Rebuild twice locally: `docker build -t lab2 .` followed by another `docker build -t lab2 .`. The second build should report `Using cache` for the dependency layer.
- Run the container and ensure the app still responds:

  ```bash
  docker run --rm -p 8080:8080 lab2
  curl http://localhost:8080/health
  ```

## Self-check before submitting

- Does `docker build` show cached dependency layers on subsequent builds?
- Does the container still start with `python app.py` and print “Hello from Lab 2!” on `/health`?
- Is your Dockerfile free from redundant `pip install` commands or duplicate `COPY . .` instructions?

If all answers are “yes”, the judge will mirror those steps and mark the lab complete. For a full walkthrough, peek at the reference solution below once you have attempted it yourself.
