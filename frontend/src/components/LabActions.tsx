"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DISPLAY_API_BASE, apiPost } from "@/lib/api";
import { fetchActiveLabSession, fetchSession, type SessionDetail } from "@/lib/labs";
import { useAuth } from "@/components/AuthProvider";
import { useLabSession } from "@/components/LabSessionProvider";
import CollapsiblePanel from "@/components/ui/CollapsiblePanel";

type Props = {
  slug: string;
  initialSessionId?: string | null;
};

type Message = { kind: "success" | "error"; text: string };

type LoadingState = "start" | "judge" | "history" | null;

type StartSessionResponse = {
  session_id: string;
  ttl: number;
  runner_container: string;
  expires_at: string;
  replaced_session_ids?: string[];
};

const API_UNREACHABLE_TEXT = `Cannot reach the ContainrLab API at ${DISPLAY_API_BASE}. Is the backend running?`;
const HISTORY_LIMIT = 10;

function isNetworkError(error: unknown): error is Error {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /fetch failed|failed to fetch|network error/i.test(error.message))
  );
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) {
    return API_UNREACHABLE_TEXT;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null) {
    return "";
  }
  if (totalSeconds <= 0) {
    return "0s";
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (hours === 0 && seconds > 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

export default function LabActions({ slug, initialSessionId }: Props) {
  const { token } = useAuth();
  const { session, sessionId, setSession, setSessionId } = useLabSession();

  const [sessionField, setSessionField] = useState<string>(initialSessionId ?? sessionId ?? "");
  const [loading, setLoading] = useState<LoadingState>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const attemptedRestoreRef = useRef(false);

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
      setSessionField(initialSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId]);

  useEffect(() => {
    if (!token) {
      attemptedRestoreRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    if (!token || attemptedRestoreRef.current) {
      return;
    }
    if (initialSessionId || sessionId) {
      attemptedRestoreRef.current = true;
      return;
    }
    attemptedRestoreRef.current = true;
    let cancelled = false;
    const restore = async () => {
      try {
        const active = await fetchActiveLabSession(slug, token);
        if (cancelled) {
          return;
        }
        const detail = await fetchSession(active.session_id, token, 5);
        if (cancelled) {
          return;
        }
        setSession(detail);
        setSessionField(detail.session_id);
        setSessionId(detail.session_id);
        setMessage({ kind: "success", text: `Restored session ${detail.session_id}.` });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const status = (error as any)?.status ?? (error as any)?.payload?.status;
        if (status === 404) {
          return;
        }
        if (isNetworkError(error)) {
          setMessage({ kind: "error", text: API_UNREACHABLE_TEXT });
          return;
        }
        console.warn("Failed to restore lab session", error);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId, sessionId, setSession, setSessionId, slug, token]);

  useEffect(() => {
    setSessionField(sessionId ?? "");
  }, [sessionId]);

  const currentSessionId = useMemo(() => (sessionField || sessionId || "").trim(), [sessionField, sessionId]);

  const expiresAt = session?.expires_at ? new Date(session.expires_at).getTime() : null;
  const endedAt = session?.ended_at ? new Date(session.ended_at).getTime() : null;
  const sessionExpired = Boolean(endedAt) || (expiresAt !== null && Date.now() >= expiresAt);
  const ttlWarning = !sessionExpired && remainingSeconds !== null && remainingSeconds <= 300;
  const ttlPercent = useMemo(() => {
    if (!session || !session.ttl_seconds || remainingSeconds === null || sessionExpired) {
      return 0;
    }
    return Math.max(0, Math.min(100, (remainingSeconds / session.ttl_seconds) * 100));
  }, [remainingSeconds, session, sessionExpired]);

  useEffect(() => {
    if (!expiresAt || sessionExpired) {
      setRemainingSeconds(null);
      return;
    }
    const update = () => {
      const diff = expiresAt - Date.now();
      setRemainingSeconds(Math.max(0, Math.floor(diff / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, sessionExpired]);

  const requireToken = useCallback((): string => {
    if (!token) {
      const text = "Sign in to manage lab sessions.";
      setMessage({ kind: "error", text });
      throw new Error(text);
    }
    return token;
  }, [token]);

  const refreshHistory = useCallback(
    async (id: string, limit = HISTORY_LIMIT) => {
      const authToken = requireToken();
      const detail = await fetchSession(id, authToken, limit > 0 ? limit : undefined);
      setSession(detail);
      setSessionField(detail.session_id);
      setSessionId(detail.session_id);
      setMessage(null);
      return detail;
    },
    [requireToken, setSession, setSessionId]
  );

  const handleStart = useCallback(async () => {
    try {
      setLoading("start");
      setMessage(null);
      const authToken = requireToken();
      setSession(null);
      setSessionId(null);
      setSessionField("");
      const startResponse = await apiPost<StartSessionResponse>(`/labs/${slug}/start`, {}, { token: authToken });
      const detail = await fetchSession(startResponse.session_id, authToken, 5);
      setSession(detail);
      setSessionField(detail.session_id);
      setSessionId(detail.session_id);
      const replacedIds = startResponse.replaced_session_ids ?? [];
      const replacedText = replacedIds.length > 0 ? ` Closed previous session${replacedIds.length > 1 ? "s" : ""} ${replacedIds.join(", ")}.` : "";
      setMessage({ kind: "success", text: `Session ${startResponse.session_id} started.${replacedText}` });
    } catch (error) {
      setMessage({ kind: "error", text: resolveErrorMessage(error, "Failed to start session.") });
    } finally {
      setLoading(null);
    }
  }, [requireToken, setSession, setSessionId, slug]);

  const handleJudge = useCallback(async () => {
    const id = currentSessionId;
    if (!id) {
      setMessage({ kind: "error", text: "Provide a session ID first." });
      return;
    }
    if (sessionExpired) {
      setMessage({ kind: "error", text: "Session expired. Start a new session first." });
      return;
    }
    try {
      setLoading("judge");
      setMessage(null);
      const authToken = requireToken();
      const result = await apiPost<{ passed: boolean }>(`/labs/${slug}/check`, { session_id: id }, { token: authToken });
      await refreshHistory(id);
      setMessage({
        kind: result.passed ? "success" : "error",
        text: result.passed ? "Judge passed! 🎉" : "Judge reported failures. Review the hints below.",
      });
    } catch (error) {
      if (isNetworkError(error)) {
        setMessage({ kind: "error", text: API_UNREACHABLE_TEXT });
        return;
      }
      const payload = error && typeof error === "object" ? (error as any).payload : null;
      let text = error instanceof Error ? error.message : "Judge request failed.";
      if (payload?.detail && typeof payload.detail === "string") {
        text = payload.detail;
      }
      setMessage({ kind: "error", text });
    } finally {
      setLoading(null);
    }
  }, [currentSessionId, refreshHistory, requireToken, sessionExpired, slug]);

  const handleHistoryRefresh = useCallback(async () => {
    const id = currentSessionId;
    if (!id) {
      setMessage({ kind: "error", text: "Provide a session ID first." });
      return;
    }
    try {
      setLoading("history");
      await refreshHistory(id, HISTORY_LIMIT);
      setMessage({ kind: "success", text: "History refreshed." });
    } catch (error) {
      setMessage({ kind: "error", text: resolveErrorMessage(error, "Failed to load history.") });
    } finally {
      setLoading(null);
    }
  }, [currentSessionId, refreshHistory]);

  const attempts = useMemo(() => session?.attempts ?? [], [session]);

  const actionsDisabled = !token || loading !== null;

  const handleCopySessionId = useCallback(async () => {
    if (!currentSessionId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentSessionId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn("Failed to copy session id", error);
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (token && currentSessionId && !session) {
      void refreshHistory(currentSessionId, HISTORY_LIMIT).catch((err) => {
        console.warn("Failed to hydrate session history", err);
      });
    }
  }, [currentSessionId, refreshHistory, session, token]);

  return (
    <div className="space-y-5">
      <CollapsiblePanel
        title="Session controls"
        subtitle={
          !token
            ? "Sign in above to enable session actions."
            : "Start a fresh workspace, run the judge, or inspect prior attempts."
        }
        actions={
          <div className="flex flex-wrap gap-3">
            <motion.button
              type="button"
              onClick={handleStart}
              disabled={actionsDisabled}
              whileHover={!actionsDisabled ? { scale: 1.05 } : {}}
              whileTap={!actionsDisabled ? { scale: 0.98 } : {}}
              className="btn-ripple rounded-full border border-sky-400 bg-gradient-to-r from-sky-500/10 to-transparent px-4 py-2 text-sm font-medium text-sky-100 shadow-lg shadow-sky-500/10 transition hover:border-sky-300 hover:from-sky-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {loading === "start" ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                  Starting...
                </span>
              ) : (
                "Start session"
              )}
            </motion.button>
            <motion.button
              type="button"
              onClick={handleJudge}
              disabled={!token || loading === "judge" || sessionExpired || !currentSessionId}
              whileHover={!(!token || loading === "judge" || sessionExpired || !currentSessionId) ? { scale: 1.05 } : {}}
              whileTap={!(!token || loading === "judge" || sessionExpired || !currentSessionId) ? { scale: 0.98 } : {}}
              className="btn-ripple rounded-full border border-emerald-400 bg-gradient-to-r from-emerald-500/10 to-transparent px-4 py-2 text-sm font-medium text-emerald-100 shadow-lg shadow-emerald-500/10 transition hover:border-emerald-300 hover:from-emerald-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {loading === "judge" ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  Checking...
                </span>
              ) : (
                "Run judge"
              )}
            </motion.button>
            <motion.button
              type="button"
              onClick={handleHistoryRefresh}
              disabled={!token || loading === "history" || !currentSessionId}
              whileHover={!(!token || loading === "history" || !currentSessionId) ? { scale: 1.05 } : {}}
              whileTap={!(!token || loading === "history" || !currentSessionId) ? { scale: 0.98 } : {}}
              className="btn-ripple rounded-full border border-slate-500 bg-gradient-to-r from-slate-500/10 to-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:bg-slate-700/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === "history" ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  Refreshing...
                </span>
              ) : (
                "Refresh history"
              )}
            </motion.button>
          </div>
        }
      >
        {session && (
          <p
            className={`text-xs ${sessionExpired ? "text-red-300" : ttlWarning ? "text-amber-200" : "text-slate-400"}`}
          >
            {sessionExpired
              ? `Session expired at ${new Date(session.ended_at ?? session.expires_at).toLocaleTimeString()}`
              : `Session expires in ${formatDuration(remainingSeconds)} (${new Date(
                  session.expires_at
                ).toLocaleTimeString()})`}
          </p>
        )}
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Session ID
            <div className="flex items-center gap-2">
              <input
                value={sessionField}
                readOnly
                className="flex-1 cursor-not-allowed rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              />
              <button
                type="button"
                onClick={handleCopySessionId}
                className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800/60 disabled:opacity-60"
                disabled={!currentSessionId}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </label>
          {session && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>TTL remaining</span>
                <span className={ttlWarning ? "text-amber-200" : "text-slate-200"}>{formatDuration(remainingSeconds)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${ttlWarning ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${ttlPercent}%` }}
                />
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">Session IDs stay linked to your account and refresh automatically.</p>
        </div>
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${
                message.kind === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 shadow-emerald-500/20"
                  : "border-red-500/40 bg-red-500/10 text-red-200 shadow-red-500/20"
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsiblePanel>

      <CollapsiblePanel title="Current session">
        {session ? (
          <div className="space-y-2 text-sm text-slate-300">
            <div>
              <span className="text-slate-500">Session ID:</span>{" "}
              <code className="break-all font-mono text-slate-100">{session.session_id}</code>
            </div>
            <div>
              <span className="text-slate-500">Runner container:</span>{" "}
              <code className="break-all font-mono text-slate-100">{session.runner_container}</code>
            </div>
            <div className="flex flex-wrap gap-4 text-slate-400">
              <span>Lab: {session.lab_slug}</span>
              <span>TTL: {Math.round(session.ttl_seconds / 60)}m</span>
              <span>Created: {new Date(session.created_at).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No session yet. Start one to populate workspace files, terminal, and judge history.
          </p>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Recent judge attempts" subtitle="Newest attempts first">
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-500">No attempts yet. Run the judge to populate this section.</p>
        ) : (
          <ul className="relative space-y-6 border-l border-white/10 pl-6 text-sm">
            {attempts.map((attempt, index) => (
              <motion.li
                key={attempt.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="relative rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-lg shadow-black/20"
              >
                <span
                  className={`absolute -left-[39px] top-4 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    attempt.passed ? "border-emerald-400 bg-emerald-500/20" : "border-red-400 bg-red-500/20"
                  }`}
                />
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">Attempt #{attempt.id}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      attempt.passed ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"
                    }`}
                  >
                    {attempt.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{new Date(attempt.created_at).toLocaleString()}</p>
                {attempt.failures.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm text-red-200">
                    {attempt.failures.map((failure, idx) => (
                      <li key={`${failure.code}-${idx}`}>
                        <p className="font-medium">{failure.message}</p>
                        {failure.hint && <p className="text-xs text-red-100/80">Hint: {failure.hint}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                {Object.keys(attempt.metrics || {}).length > 0 && (
                  <div className="mt-3 text-xs text-slate-400">
                    <p className="font-semibold uppercase tracking-wide text-slate-300">Metrics</p>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950/80 p-3 text-xs text-slate-200">
                      {JSON.stringify(attempt.metrics, null, 2)}
                    </pre>
                  </div>
                )}
                {attempt.notes && Object.keys(attempt.notes).length > 0 && (
                  <div className="mt-3 text-xs text-slate-400">
                    <p className="font-semibold uppercase tracking-wide text-slate-300">Notes</p>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950/80 p-3 text-xs text-slate-200">
                      {JSON.stringify(attempt.notes, null, 2)}
                    </pre>
                  </div>
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </CollapsiblePanel>
    </div>
  );
}
