"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";
import type { SessionDetail } from "@/lib/labs";

type Props = {
  slug: string;
  initialSession?: SessionDetail | null;
};

type Message = { kind: "success" | "error"; text: string };

async function postJson(path: string, payload: unknown) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.message === "string"
        ? data.message
        : `Request failed with status ${response.status}`;
    const error = new Error(detail);
    (error as any).payload = data;
    throw error;
  }
  return data;
}

async function getJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed with status ${response.status}`;
    const error = new Error(detail);
    (error as any).payload = data;
    throw error;
  }
  return data;
}

export default function LabActions({ slug, initialSession }: Props) {
  const [session, setSession] = useState<SessionDetail | null>(
    initialSession ?? null
  );
  const [sessionField, setSessionField] = useState<string>(
    initialSession?.session_id ?? ""
  );
  const [historyLimit, setHistoryLimit] = useState<number>(5);
  const [loading, setLoading] = useState<
    "start" | "judge" | "history" | "load-more" | null
  >(null);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
      setSessionField(initialSession.session_id);
    }
  }, [initialSession]);

  const attempts = useMemo(() => session?.attempts ?? [], [session]);
  const currentSessionId = sessionField || session?.session_id || "";

  const refreshHistory = useCallback(
    async (id: string, limit = historyLimit) => {
      const trimmed = id.trim();
      if (!trimmed) {
        setMessage({ kind: "error", text: "Provide a session ID first." });
        return null;
      }
      const detail = (await getJson(
        `/sessions/${trimmed}?limit=${limit}`
      )) as SessionDetail;
      setSession(detail);
      setSessionField(trimmed);
      return detail;
    },
    [historyLimit]
  );

  const handleStart = useCallback(async () => {
    setLoading("start");
    setMessage(null);
    setHistoryLimit(5);
    try {
      const data = await postJson(`/labs/${slug}/start`, {});
      const detail = (await getJson(
        `/sessions/${data.session_id}?limit=5`
      )) as SessionDetail;
      setSession(detail);
      setSessionField(data.session_id);
      setMessage({
        kind: "success",
        text: `Session ${data.session_id} started.`,
      });
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Failed to start session.";
      setMessage({ kind: "error", text });
    } finally {
      setLoading(null);
    }
  }, [slug]);

  const handleJudge = useCallback(async () => {
    const id = currentSessionId.trim();
    if (!id) {
      setMessage({ kind: "error", text: "Provide a session ID first." });
      return;
    }
    setLoading("judge");
    setMessage(null);
    try {
      const result = await postJson(`/labs/${slug}/check`, {
        session_id: id,
      });
      await refreshHistory(id);
      setMessage({
        kind: result.passed ? "success" : "error",
        text: result.passed
          ? "Judge passed! 🎉"
          : "Judge reported failures. Review the hints below.",
      });
    } catch (error) {
      const payload =
        error && typeof error === "object" ? (error as any).payload : null;
      let text =
        error instanceof Error ? error.message : "Judge request failed.";
      if (payload?.detail && typeof payload.detail === "string") {
        text = payload.detail;
      }
      setMessage({ kind: "error", text });
    } finally {
      setLoading(null);
    }
  }, [currentSessionId, refreshHistory, slug]);

  const handleHistoryRefresh = useCallback(async () => {
    const id = currentSessionId.trim();
    if (!id) {
      setMessage({ kind: "error", text: "Provide a session ID first." });
      return;
    }
    setLoading("history");
    setMessage(null);
    try {
      await refreshHistory(id, historyLimit);
      setMessage({ kind: "success", text: "History refreshed." });
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Failed to load history.";
      setMessage({ kind: "error", text });
    } finally {
      setLoading(null);
    }
  }, [currentSessionId, historyLimit, refreshHistory]);

  const handleLoadMore = useCallback(async () => {
    const id = currentSessionId.trim();
    if (!id) {
      setMessage({ kind: "error", text: "Provide a session ID first." });
      return;
    }
    const nextLimit = historyLimit + 5;
    setHistoryLimit(nextLimit);
    setLoading("load-more");
    try {
      await refreshHistory(id, nextLimit);
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Failed to load more attempts.";
      setMessage({ kind: "error", text });
    } finally {
      setLoading(null);
    }
  }, [currentSessionId, historyLimit, refreshHistory]);

  return (
    <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Session controls
          </h2>
          <p className="text-sm text-slate-400">
            Start a fresh workspace, run the judge, or inspect prior attempts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleStart}
            disabled={loading === "start"}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "start" ? "Starting..." : "Start session"}
          </button>
          <button
            type="button"
            onClick={handleJudge}
            disabled={loading === "judge"}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "judge" ? "Checking..." : "Run judge"}
          </button>
          <button
            type="button"
            onClick={handleHistoryRefresh}
            disabled={loading === "history"}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "history" ? "Refreshing..." : "Refresh history"}
          </button>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading === "load-more"}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "load-more" ? "Loading..." : "Load more"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Session ID
          <input
            value={sessionField}
            onChange={(event) => setSessionField(event.target.value)}
            placeholder="Paste an existing session ID"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          After running the judge or starting a new session you can refresh or load
          more attempts using this identifier.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.kind === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/40 bg-red-500/10 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="font-semibold text-slate-100">Current session</h3>
        {session ? (
          <div className="space-y-2 text-sm text-slate-300">
            <div>
              <span className="text-slate-500">Session ID:</span>{" "}
              <code className="break-all text-slate-200">{session.session_id}</code>
            </div>
            <div>
              <span className="text-slate-500">Runner container:</span>{" "}
              <code className="break-all text-slate-200">
                {session.runner_container}
              </code>
            </div>
            <div className="flex flex-wrap gap-4 text-slate-400">
              <span>Lab: {session.lab_slug}</span>
              <span>
                TTL: {Math.round(session.ttl_seconds / 60)}m
              </span>
              <span>
                Created: {new Date(session.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No session yet. Start one or paste an existing session ID to view
            details and history.
          </p>
        )}
      </div>

      <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">
            Recent judge attempts
          </h3>
          <span className="text-xs text-slate-500">
            Showing up to {historyLimit} entries
          </span>
        </div>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-500">
            No attempts yet. Run the judge to populate this section.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">
                    Attempt #{attempt.id}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      attempt.passed
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-200"
                    }`}
                  >
                    {attempt.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(attempt.created_at).toLocaleString()}
                </p>
                {attempt.failures.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm text-red-200">
                    {attempt.failures.map((failure, idx) => (
                      <li key={`${failure.code}-${idx}`}>
                        <p className="font-medium">{failure.message}</p>
                        {failure.hint && (
                          <p className="text-xs text-red-100/80">
                            Hint: {failure.hint}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {Object.keys(attempt.metrics || {}).length > 0 && (
                  <div className="mt-3 text-xs text-slate-400">
                    <p className="font-semibold uppercase tracking-wide text-slate-300">
                      Metrics
                    </p>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950/80 p-3 text-xs text-slate-200">
                      {JSON.stringify(attempt.metrics, null, 2)}
                    </pre>
                  </div>
                )}
                {attempt.notes &&
                  Object.keys(attempt.notes).length > 0 && (
                    <div className="mt-3 text-xs text-slate-400">
                      <p className="font-semibold uppercase tracking-wide text-slate-300">
                        Notes
                      </p>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950/80 p-3 text-xs text-slate-200">
                        {JSON.stringify(attempt.notes, null, 2)}
                      </pre>
                    </div>
                  )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
