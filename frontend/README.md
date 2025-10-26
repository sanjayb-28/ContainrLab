# ContainrLab Frontend

A Next.js App Router UI that surfaces labs, session management, and judge history powered by the FastAPI backend.

## Prerequisites

- Node.js 20+
- Backend + runner stack running (via `docker compose`) so the API is reachable, defaulting to `http://localhost:8000`.
- Optionally set `NEXT_PUBLIC_API_BASE` if the API is exposed elsewhere.

## Development

Before running the dev server, copy `.env.local.example` to `.env.local` and fill in your GitHub OAuth credentials plus a `NEXTAUTH_SECRET`. These values are required for the “Continue with GitHub” login button.
Set `NEXTAUTH_URL` to the origin you’ll use locally (for example `http://localhost:3000`); NextAuth needs it to build redirect URLs.

```bash
cd frontend
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to browse labs, start sessions, run the judge, and view recent attempts.

## Production build

```bash
npm run build
npm run start
```

The accompanying Dockerfile performs these steps and exposes the app on port `3000` for the compose stack.
