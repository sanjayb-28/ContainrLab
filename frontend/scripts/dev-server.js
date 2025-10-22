#!/usr/bin/env node
/**
 * Minimal development server for ContainrLab.
 *
 * Renders a lab list and detail views by talking to the FastAPI backend.
 * Keeps dependencies light so we can iterate before introducing Next.js.
 */

const http = require("http");
const { URL } = require("url");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  "http://localhost:8000";

function log(...args) {
  // eslint-disable-next-line no-console
  console.log("[frontend]", ...args);
}

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(
      `Request to ${url} failed with ${response.status}: ${response.statusText}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
}

function renderLayout(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0 auto;
        padding: 2rem 1.5rem 4rem;
        max-width: 960px;
        line-height: 1.5;
        background: #0f172a;
        color: #e2e8f0;
      }
      a {
        color: #60a5fa;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      header {
        display: flex;
        gap: 1rem;
        align-items: baseline;
        margin-bottom: 1.5rem;
      }
      header h1 {
        margin: 0;
        font-size: clamp(1.75rem, 3vw, 2.4rem);
      }
      .card {
        background: rgba(15, 23, 42, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
        margin-bottom: 1rem;
      }
      .card h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.35rem;
      }
      .card p {
        margin: 0;
        color: #cbd5f5;
      }
      .summary {
        font-size: 1.1rem;
        color: #cbd5f5;
        margin: 0.5rem 0 1.5rem;
      }
      nav a {
        font-size: 0.95rem;
        display: inline-block;
        margin-bottom: 1rem;
      }
      form {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 1rem;
      }
      label {
        display: flex;
        flex-direction: column;
        font-size: 0.9rem;
        gap: 0.25rem;
      }
      input {
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        padding: 0.4rem 0.6rem;
        background: rgba(15, 23, 42, 0.75);
        color: inherit;
      }
      button {
        border-radius: 8px;
        border: none;
        padding: 0.5rem 1rem;
        font-weight: 600;
        background: #2563eb;
        color: white;
        cursor: pointer;
      }
      button:hover {
        background: #1d4ed8;
      }
      pre {
        background: rgba(15, 23, 42, 0.65);
        border-radius: 12px;
        padding: 1rem;
        overflow-x: auto;
        border: 1px solid rgba(148, 163, 184, 0.15);
      }
      .message {
        border-left: 4px solid #38bdf8;
        padding: 0.75rem 1rem;
        margin-bottom: 1rem;
        background: rgba(8, 47, 73, 0.65);
      }
      .message.error {
        border-color: #f87171;
        background: rgba(69, 10, 10, 0.65);
      }
    </style>
  </head>
  <body>
    <header>
      <h1>ContainrLab</h1>
      <span style="color:#94a3b8;">Hands-on container lessons</span>
    </header>
    ${content}
  </body>
</html>`;
}

function renderLabList(labs) {
  if (!labs.length) {
    return `<p>No labs found yet. Populate <code>labs/</code> to get started.</p>`;
  }
  const items = labs
    .map(
      (lab) => `
      <article class="card">
        <h2><a href="/labs/${encodeURIComponent(lab.slug)}">${escapeHtml(
        lab.title || lab.slug
      )}</a></h2>
        ${
          lab.summary
            ? `<p class="summary">${escapeHtml(lab.summary)}</p>`
            : ""
        }
        <p>
          <strong>Starter:</strong> ${lab.has_starter ? "✅" : "❌"} &nbsp;
          <strong>Slug:</strong> ${escapeHtml(lab.slug)}
        </p>
      </article>`
    )
    .join("\n");
  return `<section>${items}</section>`;
}

function renderCodeBlock(title, payload) {
  if (!payload) {
    return "";
  }
  const pretty = escapeHtml(JSON.stringify(payload, null, 2));
  return `<div class="card">
    <h3>${escapeHtml(title)}</h3>
    <pre>${pretty}</pre>
  </div>`;
}

function renderError(message, details) {
  const body = escapeHtml(message);
  const extra = details ? `<pre>${escapeHtml(details)}</pre>` : "";
  return `<div class="message error">
    <strong>Something went wrong.</strong>
    <p>${body}</p>
    ${extra}
  </div>`;
}

function renderLabDetail(lab, context) {
  const { slug, startResult, judgeResult, error, sessionId } = context;
  const readme = lab.readme ? escapeHtml(lab.readme) : "No README yet.";
  const summary = lab.summary
    ? `<p class="summary">${escapeHtml(lab.summary)}</p>`
    : "";
  const startMessage = startResult
    ? renderCodeBlock("Session started", startResult)
    : "";
  const judgeMessage = judgeResult
    ? renderCodeBlock("Judge response", judgeResult)
    : "";
  const errorMessage = error ? renderError(error.title, error.details) : "";
  return `
    <nav><a href="/">&larr; Back to labs</a></nav>
    <article class="card">
      <h2>${escapeHtml(lab.title || slug)}</h2>
      ${summary}
      <p><strong>Slug:</strong> ${escapeHtml(slug)}</p>
    </article>
    ${errorMessage}
    <section class="card">
      <h3>Start a fresh session</h3>
      <form method="get">
        <input type="hidden" name="action" value="start" />
        <button type="submit">Start session</button>
      </form>
      <p style="color:#94a3b8; margin-top:0;">Starts a new runner container and returns a session ID.</p>
      ${startMessage}
    </section>
    <section class="card">
      <h3>Run judge</h3>
      <form method="get">
        <input type="hidden" name="action" value="judge" />
        <label>
          Session ID
          <input name="session_id" value="${escapeHtml(
            sessionId || ""
          )}" required />
        </label>
        <button type="submit">Check lab</button>
      </form>
      <p style="color:#94a3b8; margin-top:0;">Paste the session ID from a start response to evaluate progress.</p>
      ${judgeMessage}
    </section>
    <section class="card">
      <h3>README</h3>
      <pre>${readme}</pre>
    </section>
  `;
}

function renderNotFound(pathname) {
  return renderLayout(
    "ContainrLab | Not found",
    `<p>Sorry, we could not find <code>${escapeHtml(pathname)}</code>. <a href="/">Back to labs</a>.</p>`
  );
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    if (requestUrl.pathname === "/" || requestUrl.pathname === "/labs") {
      const labs = await fetchJson(`${API_BASE}/labs`);
      const html = renderLayout("ContainrLab | Labs", renderLabList(labs));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (requestUrl.pathname.startsWith("/labs/")) {
      const slug = requestUrl.pathname.split("/")[2];
      if (!slug) {
        const html = renderLayout(
          "ContainrLab | Missing slug",
          `<p>Please provide a lab slug. <a href="/">Back to labs</a>.</p>`
        );
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      let startResult = null;
      let judgeResult = null;
      let sessionId = requestUrl.searchParams.get("session_id") || "";
      let errorMessage = null;

      const action = requestUrl.searchParams.get("action");
      try {
        if (action === "start") {
          startResult = await postJson(`${API_BASE}/labs/${slug}/start`, {});
          sessionId = startResult.session_id || sessionId;
        } else if (action === "judge") {
          if (!sessionId) {
            throw new Error("A session_id query parameter is required to judge.");
          }
          judgeResult = await postJson(`${API_BASE}/labs/${slug}/check`, {
            session_id: sessionId,
          });
        }
      } catch (error) {
        log("API action error:", error);
        errorMessage = {
          title: error.message,
          details: error.payload ? JSON.stringify(error.payload, null, 2) : "",
        };
      }

      let lab;
      try {
        lab = await fetchJson(`${API_BASE}/labs/${slug}`);
      } catch (error) {
        const html = renderLayout(
          "ContainrLab | Error",
          renderError(
            "Unable to load lab metadata.",
            error.payload ? JSON.stringify(error.payload, null, 2) : ""
          )
        );
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      const content = renderLabDetail(lab, {
        slug,
        startResult,
        judgeResult,
        sessionId,
        error: errorMessage,
      });
      const html = renderLayout(
        `ContainrLab | ${lab.title || slug}`,
        content
      );
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (requestUrl.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    const html = renderNotFound(requestUrl.pathname);
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (error) {
    log("Unhandled error:", error);
    const html = renderLayout(
      "ContainrLab | Error",
      renderError(
        "Unexpected error rendering the page.",
        error && error.stack ? error.stack : String(error)
      )
    );
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  }
});

server.listen(PORT, () => {
  log(`UI server listening on http://localhost:${PORT}`);
  log(`Using API base: ${API_BASE}`);
});
