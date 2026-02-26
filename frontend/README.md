# Frontend Web Application

Next.js application providing the ContainrLab user interface.

---

## Quick Start

### Local Development

```bash
# Install dependencies
cd frontend
npm install

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

**Or with Docker Compose:**
```bash
docker compose -f compose/docker-compose.yml up frontend
```

---

## Environment Variables

Create `.env.local` file:

```bash
# API endpoints
NEXT_PUBLIC_API_BASE=http://localhost:8000
API_INTERNAL_BASE=http://api:8000

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

---

## Application Structure

```
app/
├── (auth)/              # Authentication pages
├── labs/                # Lab listing and detail pages
├── api/                 # NextAuth API routes
└── page.tsx             # Home page

components/
├── Terminal/            # xterm.js terminal component
├── Editor/              # Code editor
├── JudgeResults/        # Validation feedback UI
└── Layout/              # Layout components
```

---

## Scripts

```bash
# Development
npm run dev              # Start dev server

# Building
npm run build            # Production build
npm run start            # Start production server

# Testing
npm run test             # Run tests
npm run type-check       # TypeScript checking

# Linting
npm run lint             # ESLint
npm run format           # Prettier
```

---

## Related Documentation

- [Architecture](../docs/ARCHITECTURE.md) - System design
- [Deployment](../docs/DEPLOYMENT.md) - Deploy to production
- [Main README](../README.md) - Project overview
