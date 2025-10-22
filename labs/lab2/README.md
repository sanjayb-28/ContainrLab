# Lab 2: Layers & Cache

Your goal is to optimise Docker layer caching so repeating a build after small source changes is fast.

## Requirements

1. **Respect dependency caching**
   - Copy `requirements.txt` into the image before copying the rest of the project files.
   - Install Python dependencies with `pip install --no-cache-dir -r requirements.txt`.
   - Only copy the remainder of the source (`COPY . .`) *after* installing dependencies.

2. **Keep layers tidy**
   - Use a single `RUN` command for the dependency install.
   - Avoid unnecessary `pip install` repetitions or `COPY . .` before the dependency layer.

3. **Final image should still run**
   - Default command must execute `python app.py`.
   - App should print `"Hello from Lab 2!"` when run.

The judge will parse your `Dockerfile` and ensure the dependency `COPY` comes before the `pip install`, and both come before the final `COPY . .`. It will also fail builds that cannot install dependencies.
