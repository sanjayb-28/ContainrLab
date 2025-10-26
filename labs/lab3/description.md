# Lab 3 · Multi-stage mastery

The starter image ships everything in one bloated layer. Your mission: convert it into a lean multi-stage build while preserving the health endpoint at `http://localhost:8080/health`.

## What to deliver

1. **Builder stage**
   - Install Node dependencies and run the build (`npm install`, `npm run build`).
   - Keep dev tooling in this stage only.
2. **Runtime stage**
   - Start from a slim Node base (e.g. `node:18-alpine`).
   - Copy only the compiled `dist/` output and the minimal files needed to run `npm start`.
   - Install production dependencies with `npm install --omit=dev` (or `npm ci --omit=dev`).
3. **Healthy container**
   - Expose `8080`, run `npm start`, and keep the health endpoint returning 200.

## Suggested workflow

- Inspect the starter Dockerfile: everything happens in a single stage, so the final image contains dev dependencies and the entire source tree.
- Introduce a `builder` stage that handles `npm install` and `npm run build`.
- Copy only `package*.json` into the runtime stage, install production dependencies, then copy the `dist/` assets from the builder stage.
- Run the container locally and hit `/health` to confirm it still reports `ok`.
- Use `docker image ls lab3-multi` to verify the new image is dramatically smaller (target < 250 MB).

## Self-check before submitting

- Does `docker build -t lab3-multi .` succeed with your multi-stage Dockerfile?
- Does `docker run --rm -p 8080:8080 lab3-multi` still serve `curl http://localhost:8080/health` with HTTP 200?
- Is the final image noticeably smaller than the single-stage version and free from dev dependencies?

Once those answers are yes, the automated judge will run the same checks. Peek at the reference solution below if you need a sanity check after attempting the lab yourself.
