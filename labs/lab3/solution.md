# Lab 3 · Reference Solution (Explained)

We split the build into two stages: one for compiling the Express app and one for running it.

## File layout

```
/workspace
├── package.json
├── package-lock.json
├── tsconfig.json
├── src/
└── Dockerfile
```

## Dockerfile – multi-stage build

```dockerfile
# Stage 1: build the application
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: production runtime
FROM node:18-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the compiled assets from the builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 8080
CMD ["npm", "start"]
```

Highlights:
- The builder stage keeps TypeScript, build tooling, and dev dependencies out of the final image.
- The runtime stage installs production dependencies only and copies the compiled `dist/` folder.
- Using the same base image (`node:18-alpine`) keeps both stages lightweight and compatible.

## Verify locally

```bash
# Build the lean image
$ docker build -t lab3-multi .

# Start the container and test the health endpoint
$ docker run --rm -p 8080:8080 lab3-multi
$ curl http://localhost:8080/health
{"ok":true}

# Check size (should be well below 250 MB)
$ docker image ls lab3-multi
```

If the image is still large, double-check that you aren’t copying the entire source tree into the final stage or installing dev dependencies there.
