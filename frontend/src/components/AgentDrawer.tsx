"use client";

import { useEffect, useMemo, useState } from "react";
import { requestExplain, requestHint, type AgentResponse } from "@/lib/agent";

type AgentMode = "hint" | "explain";

type AgentHistoryEntry = {
  id: string;
  mode: AgentMode;
  prompt: string;
  answer?: string;
  source: string;
  error?: string;
  timestamp: number;
};

type AgentDrawerProps = {
  sessionId?: string;
  labSlug?: string;
};

function createEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function AgentDrawer({ sessionId, labSlug }: AgentDrawerProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<AgentHistoryEntry[]>([]);
  const [loadingMode, setLoadingMode] = useState<AgentMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrompt("");
    setHistory([]);
    setError(null);
    setLoadingMode(null);
  }, [sessionId]);

  const disabled = !sessionId || loadingMode !== null;
  const latest = history[0];

  const statusText = useMemo(() => {
    if (loadingMode) {
      return loadingMode === "hint" ? "Requesting a hint..." : "Requesting an explanation...";
    }
    if (!latest) {
      return null;
    }
    if (latest.error) {
      return `Last attempt failed (${new Date(latest.timestamp).toLocaleTimeString()}).`;
    }
    return `Last response from ${latest.source} at ${new Date(latest.timestamp).toLocaleTimeString()}.`;
  }, [latest, loadingMode]);

  const handleSuccess = (mode: AgentMode, requestPrompt: string, response: AgentResponse) => {
    const entry: AgentHistoryEntry = {
      id: createEntryId(),
      mode,
      prompt: requestPrompt,
      answer: response.answer,
      source: response.source,
      timestamp: Date.now(),
    };
    setHistory((prev) => [entry, ...prev]);
    setError(null);
    setPrompt("");
  };

  const handleFailure = (mode: AgentMode, requestPrompt: string, message: string) => {
    const entry: AgentHistoryEntry = {
      id: createEntryId(),
      mode,
      prompt: requestPrompt,
      source: "error",
      error: message,
      timestamp: Date.now(),
    };
    setHistory((prev) => [entry, ...prev]);
    setError(message);
  };

  const sendRequest = async (mode: AgentMode) => {
    if (!sessionId) {
      return;
    }
    if (!prompt.trim()) {
      setError("Enter a prompt first.");
      return;
    }
    setLoadingMode(mode);
    setError(null);
    setOpen(true);
    const trimmedPrompt = prompt.trim();
    try {
      const response =
        mode === "hint"
          ? await requestHint(sessionId, trimmedPrompt, labSlug)
          : await requestExplain(sessionId, trimmedPrompt, labSlug);
      handleSuccess(mode, trimmedPrompt, response);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Agent request failed. Please try again.";
      handleFailure(mode, trimmedPrompt, message);
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="text-sm font-semibold text-sky-400 hover:text-sky-300"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Close Agent" : "Open Agent"}
        </button>
        {history.length > 0 && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setHistory([])}
          >
            Clear history
          </button>
        )}
      </div>

      {statusText && (
        <p className="mb-3 text-xs text-slate-400">
          {loadingMode && (
            <span className="mr-2 inline-flex h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent align-middle" />
          )}
          {statusText}
        </p>
      )}

      {open && (
        <div className="space-y-4 text-sm text-slate-200">
          {!sessionId && (
            <p className="text-slate-500">Start a session to chat with the agent.</p>
          )}
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask for a hint or explanation..."
            className="h-24 w-full rounded border border-slate-800 bg-slate-950 p-2 text-slate-100 placeholder:text-slate-500"
            disabled={!sessionId || loadingMode !== null}
          />
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => sendRequest("hint")}
              disabled={disabled}
            >
              {loadingMode === "hint" ? "Sending..." : "Ask for hint"}
            </button>
            <button
              type="button"
              className="rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => sendRequest("explain")}
              disabled={disabled}
            >
              {loadingMode === "explain" ? "Sending..." : "Ask for explain"}
            </button>
          </div>
          {error && <p className="text-red-300">{error}</p>}

          <div className="space-y-3">
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">No agent responses yet.</p>
            ) : (
              history.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200"
                >
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                    <span>{entry.mode === "hint" ? "Hint" : "Explanation"}</span>
                    <span>
                      {entry.error
                        ? "Failed"
                        : entry.source === "gemini"
                        ? "Gemini"
                        : entry.source === "fallback"
                        ? "Fallback"
                        : entry.source}
                    </span>
                  </div>
                  <p className="mb-2 text-slate-400">
                    <span className="font-semibold text-slate-300">You:</span> {entry.prompt}
                  </p>
                  {entry.error ? (
                    <p className="text-red-300">{entry.error}</p>
                  ) : (
                    <p className="whitespace-pre-wrap text-slate-100">
                      {entry.answer ?? "No response available."}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
