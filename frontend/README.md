# Frontend

Lightweight Node-based UI for surfacing labs while the full Next.js app is under construction.

## Development

```
npm install
npm run dev
```

The dev server runs on port 3000 and proxies to the FastAPI backend using the `NEXT_PUBLIC_API_BASE` (or `API_BASE_URL`) environment variable.
