# Lab 3: Multi-Stage Builds

Level up your Docker skills by converting the starter image into a lean multi-stage build. The sample app is a small Express server that serves a `/health` endpoint. The current Dockerfile installs everything in a single stage which leaves development dependencies and build tooling inside the final image.

## Your Goals

1. **Split the Dockerfile into at least two stages.** Name the first stage `builder` (or similar) and keep dependency installs and build tooling there.
2. **Produce a slim runtime image.** Copy only the compiled `dist/` output and the production dependencies into the final stage. Aim for an image smaller than **250&nbsp;MB**.
3. **Expose the server correctly.** The container should continue to listen on port `8080` and run `npm start`.
4. **Keep the health endpoint working.** `curl http://localhost:8080/health` must return `200`.

## Tips

- Install dependencies reproducibly in the builder stage (`npm install` is fine; add a lockfile if you prefer `npm ci`). In the runtime stage install only production dependencies (e.g. `npm install --omit=dev`).
- `npm run build` already emits the compiled assets into `dist/`.
- Alpine or distroless base images keep the final image small, but remember Node distroless images do not ship with `/bin/sh`.
- If you copy the whole project in the runtime stage, the image will still be large—copy only what you need.

Good luck! When the judge runs, it will fail if the Dockerfile is still single-stage, if the final image is too large, or if the health endpoint stops responding.
