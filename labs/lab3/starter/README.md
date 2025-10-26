# Starter Workspace

The Express app is ready to build. Your task is to convert the Dockerfile into a multi-stage build that leaves dev tooling behind.

- Stage 1 (`builder`) should install dependencies, run `npm run build`, and keep the compiled output in `/app/dist`.
- Stage 2 should install **only** production dependencies (for example `npm install --omit=dev`) and copy the built `dist/` assets from the builder stage.
- The container must continue to listen on port `8080` and run `npm start`.
- After your changes, `docker build -t lab3 .` followed by `docker run --rm -p 8080:8080 lab3` should let `curl http://localhost:8080/health` return `{"ok":true}`.

When those checks pass locally, run the judge to confirm the image is slim and healthy.
