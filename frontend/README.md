# 🌐 Frontend Web Application

Next.js application providing the ContainrLab user interface.

---

## Overview

The frontend is a modern web application built with Next.js 14, providing:
- **User interface** for labs and sessions
- **Terminal emulator** (xterm.js)
- **Code editor** for Dockerfile editing
- **GitHub OAuth** authentication
- **Real-time** WebSocket terminal connection

**Technology:** Next.js 14, React 18, TailwindCSS, xterm.js, NextAuth.js

---

## Quick Start

### Local Development

```bash
# Install dependencies
cd frontend
npm install

# Set up environment (see below)
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

**Or with Docker Compose:**
```bash
docker compose -f compose/docker-compose.yml up frontend
```

---

## Application Structure

```
app/
├── (auth)/              # Authentication pages
│   ├── login/           # Login page
│   └── layout.tsx       # Auth layout
├── labs/                # Lab pages
│   ├── page.tsx         # Lab listing
│   └── [slug]/          # Individual lab
│       ├── page.tsx     # Lab detail
│       └── session/     # Active session
│           └── [id]/
│               └── page.tsx  # Session interface
├── api/                 # API routes
│   └── auth/            # NextAuth endpoints
│       └── [...nextauth]/
│           └── route.ts
├── layout.tsx           # Root layout
└── page.tsx             # Home page

components/
├── Terminal/            # Terminal emulator
│   ├── Terminal.tsx     # xterm.js wrapper
│   └── useTerminal.ts   # Terminal hook
├── Editor/              # Code editor
│   ├── FileTree.tsx     # File browser
│   └── CodeEditor.tsx   # Monaco-style editor
├── JudgeResults/        # Lab validation UI
│   └── ResultsPanel.tsx
├── SessionControls/     # Session management
│   └── SessionButtons.tsx
└── Layout/              # Layout components
    ├── Header.tsx
    ├── Sidebar.tsx
    └── Footer.tsx

lib/
├── api.ts               # API client (fetch wrapper)
├── auth.ts              # NextAuth configuration
└── websocket.ts         # WebSocket client

types/
├── lab.ts               # Lab type definitions
├── session.ts           # Session types
└── judge.ts             # Judge result types
```

---

## Configuration

### Environment Variables

Create `.env.local` file:

```bash
# API Backend
NEXT_PUBLIC_API_BASE=http://localhost:8000

# GitHub OAuth (get from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# NextAuth.js
NEXTAUTH_SECRET=random-32-byte-hex-string  # Generate with: openssl rand -hex 32
NEXTAUTH_URL=http://localhost:3000
```

**For production:**
```bash
NEXT_PUBLIC_API_BASE=https://api.containrlab.click
NEXTAUTH_URL=https://app.containrlab.click
```

**[→ Complete secrets guide](../docs/SECRETS_MANAGEMENT.md)**

---

## Features

### Authentication

**GitHub OAuth via NextAuth.js:**

```typescript
// lib/auth.ts
export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // Add user ID to session
      session.user.id = token.sub;
      return session;
    },
  },
};
```

**Usage in components:**
```typescript
import { useSession, signIn, signOut } from 'next-auth/react';

function MyComponent() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'unauthenticated') return <button onClick={() => signIn('github')}>Sign in</button>;
  
  return <div>Welcome {session.user.name}!</div>;
}
```

---

### Terminal Emulator

**xterm.js integration:**

```typescript
// components/Terminal/Terminal.tsx
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

export function Terminal({ sessionId }: { sessionId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm>();
  const wsRef = useRef<WebSocket>();

  useEffect(() => {
    // Create terminal
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });

    // Add addons
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    // Open terminal
    term.open(terminalRef.current!);
    fitAddon.fit();

    // Connect WebSocket
    const ws = new WebSocket(
      `ws://localhost:8000/sessions/${sessionId}/terminal/ws`
    );

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    term.onData((data) => {
      ws.send(data);
    });

    xtermRef.current = term;
    wsRef.current = ws;

    return () => {
      ws.close();
      term.dispose();
    };
  }, [sessionId]);

  return <div ref={terminalRef} className="h-full w-full" />;
}
```

---

### Code Editor

**File tree and editor:**

```typescript
// components/Editor/FileTree.tsx
export function FileTree({ sessionId }: { sessionId: string }) {
  const [files, setFiles] = useState<FileNode[]>([]);

  useEffect(() => {
    // Fetch files from API
    fetch(`/api/files?session_id=${sessionId}`)
      .then(res => res.json())
      .then(setFiles);
  }, [sessionId]);

  return (
    <div className="file-tree">
      {files.map(file => (
        <FileItem key={file.path} file={file} onClick={onFileClick} />
      ))}
    </div>
  );
}

// components/Editor/CodeEditor.tsx
export function CodeEditor({ file }: { file: File }) {
  const [content, setContent] = useState('');

  const handleSave = async () => {
    await fetch(`/api/files/${file.path}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  };

  return (
    <div className="editor">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="font-mono"
      />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

---

### Judge Results Display

```typescript
// components/JudgeResults/ResultsPanel.tsx
export function ResultsPanel({ result }: { result: JudgeResult }) {
  return (
    <div className={`results ${result.passed ? 'success' : 'failure'}`}>
      <h3>{result.passed ? '✅ Passed!' : '❌ Failed'}</h3>
      
      {result.failures.map((failure) => (
        <div key={failure.code} className="failure">
          <h4>{failure.message}</h4>
          <p className="hint">💡 {failure.hint}</p>
        </div>
      ))}

      {result.metrics && (
        <div className="metrics">
          <h4>Metrics</h4>
          <ul>
            <li>Build time: {result.metrics.build.elapsed_seconds}s</li>
            <li>Image size: {result.metrics.image_size_mb}MB</li>
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## API Client

### Fetch Wrapper

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include', // Include cookies
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

// Usage
export const labsApi = {
  list: () => apiClient<Lab[]>('/labs'),
  get: (slug: string) => apiClient<Lab>(`/labs/${slug}`),
  start: (slug: string) => apiClient<Session>(`/labs/${slug}/start`, {
    method: 'POST',
  }),
};
```

---

## Styling

### Tailwind CSS

**Configuration:**
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4a90e2',
        secondary: '#50c878',
        danger: '#e74c3c',
      },
    },
  },
  plugins: [],
};
```

**Usage:**
```tsx
<button className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded">
  Start Lab
</button>
```

---

## Development

### Running Tests

```bash
# Run tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

---

### Building for Production

```bash
# Build
npm run build

# Start production server
npm start

# Or with Docker
docker build -t containrlab-web .
docker run -p 3000:3000 containrlab-web
```

---

### Code Quality

```bash
# Lint
npm run lint

# Fix linting issues
npm run lint -- --fix

# Type check
npm run type-check
```

---

## Deployment

### AWS ECS Fargate

Frontend runs on ECS Fargate with:
- ARM64 architecture
- 0.25 vCPU, 512MB RAM
- Environment variables from SSM
- CloudWatch logs

**Task definition:** `infra/task-definitions/api-web-task.json`

**[→ Complete deployment guide](../docs/DEPLOYMENTS.md)**

---

### Environment Variables in Production

**ECS task definition:**
```json
{
  "environment": [
    {
      "name": "NEXT_PUBLIC_API_BASE",
      "value": "https://api.containrlab.click"
    },
    {
      "name": "NEXTAUTH_URL",
      "value": "https://app.containrlab.click"
    }
  ],
  "secrets": [
    {
      "name": "GITHUB_CLIENT_ID",
      "valueFrom": "arn:aws:ssm:us-east-1:ACCOUNT:parameter/containrlab/GITHUB_CLIENT_ID"
    },
    {
      "name": "GITHUB_CLIENT_SECRET",
      "valueFrom": "arn:aws:ssm:us-east-1:ACCOUNT:parameter/containrlab/GITHUB_CLIENT_SECRET"
    },
    {
      "name": "NEXTAUTH_SECRET",
      "valueFrom": "arn:aws:ssm:us-east-1:ACCOUNT:parameter/containrlab/NEXTAUTH_SECRET"
    }
  ]
}
```

---

## Troubleshooting

### "API connection refused"

**Problem:** Frontend can't reach backend

**Check:**
```bash
# Verify NEXT_PUBLIC_API_BASE
echo $NEXT_PUBLIC_API_BASE

# Test backend directly
curl http://localhost:8000/healthz

# Check browser console for errors
```

---

### "OAuth redirect mismatch"

**Problem:** GitHub OAuth fails

**Solution:**
1. Go to GitHub OAuth App settings
2. Verify callback URL: `http://localhost:3000/api/auth/callback/github`
3. Update `NEXTAUTH_URL` to match

---

### "Terminal not connecting"

**Problem:** WebSocket connection fails

**Check:**
1. Backend WebSocket endpoint is accessible
2. No proxy blocking WebSocket connections
3. Browser console for WebSocket errors

```typescript
// Debug WebSocket connection
ws.onopen = () => console.log('WebSocket connected');
ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onclose = () => console.log('WebSocket closed');
```

---

### "Styles not loading"

**Problem:** Tailwind CSS not applied

**Solution:**
```bash
# Rebuild with clean cache
rm -rf .next
npm run dev
```

---

### "Session expired"

**Problem:** NextAuth session token expired

**Solution:**
```typescript
// Increase session max age
export const authOptions: NextAuthOptions = {
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
```

---

## Performance Optimization

### Next.js Image Optimization

```tsx
import Image from 'next/image';

<Image
  src="/logo.png"
  width={200}
  height={50}
  alt="ContainrLab"
  priority // Load immediately
/>
```

---

### Code Splitting

```tsx
// Lazy load heavy components
import dynamic from 'next/dynamic';

const Terminal = dynamic(() => import('@/components/Terminal'), {
  ssr: false, // Don't server-render
  loading: () => <div>Loading terminal...</div>,
});
```

---

### Caching

```typescript
// API routes with caching
export async function GET() {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    },
  });
}
```

---

## Related Documentation

- **[System Architecture](../docs/ARCHITECTURE.md)** - How frontend fits in the system
- **[Local Setup](../docs/LOCAL_SETUP.md)** - Running frontend locally
- **[Secrets Management](../docs/SECRETS_MANAGEMENT.md)** - Managing credentials
- **[Backend API](../backend/README.md)** - API documentation
- **[Deployment Guide](../docs/DEPLOYMENTS.md)** - Production deployment

---

<div align="center">

**[← Back to Documentation](../docs/README.md)**

</div>
