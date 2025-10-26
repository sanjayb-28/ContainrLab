"use client";

import { useAuth } from "@/components/AuthProvider";
import { useLabSession } from "@/components/LabSessionProvider";
import CollapsiblePanel from "@/components/ui/CollapsiblePanel";
import {
  applyPatch,
  requestExplain,
  requestHint,
  requestPatch,
  type AgentPatchFile,
  type AgentPatchResponse,
  type AgentResponse,
} from "@/lib/agent";
import { useCallback, useEffect, useMemo, useState } from "react";

type AgentMode = "hint" | "explain" | "patch";

type HintExplainEntry = {
  id: string;
  mode: "hint" | "explain";
  prompt: string;
  answer?: string;
  source: string;
  error?: string;
  timestamp: number;
};

type PatchEntry = {
  id: string;
  mode: "patch";
  prompt: string;
  message: string;
  files: AgentPatchFile[];
  source: string;
  error?: string;
  applied: boolean;
  applyError?: string;
  timestamp: number;
};

type AgentHistoryEntry = HintExplainEntry | PatchEntry;

type AgentDrawerProps = {
  labSlug?: string;
};

const MAX_HISTORY = 15;

function createEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function copyToClipboard(text: string | undefined) {
  if (!text) {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.warn("Clipboard copy failed", err);
  }
}

export default function AgentDrawer({ labSlug }: AgentDrawerProps) {
  const { token } = useAuth();
  const { sessionId } = useLabSession();
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<AgentHistoryEntry[]>([]);
  const [loadingMode, setLoadingMode] = useState<AgentMode | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyingPatchId, setApplyingPatchId] = useState<string | null>(null);

  useEffect(() => {
    setPrompt("");
    setHistory([]);
    setError(null);
    setLoadingMode(null);
    setApplyingPatchId(null);
    setAbortController((current) => {
      if (current) {
        current.abort();
      }
      return null;
    });
  }, [sessionId]);

  const disabled = !sessionId || !token || loadingMode !== null;
  const latest = history[0];

  const statusText = useMemo(() => {
    if (loadingMode) {
      if (loadingMode === "patch") {
        return "Requesting a patch suggestion...";
      }
      return loadingMode === "hint" ? "Requesting a hint..." : "Requesting an explanation...";
    }
    if (!latest) {
      return null;
    }
    const timestamp = new Date(latest.timestamp).toLocaleTimeString();
    if (latest.error) {
      return `Last attempt failed (${timestamp}).`;
    }
    if (latest.mode === "patch") {
      return `Last patch from ${latest.source} at ${timestamp}.`;
    }
    return `Last response from ${latest.source} at ${timestamp}.`;
  }, [latest, loadingMode]);

  const pushHistory = useCallback((entry: AgentHistoryEntry) => {
    setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
  }, []);

  const handleHintExplainSuccess = useCallback(
    (mode: "hint" | "explain", requestPrompt: string, response: AgentResponse) => {
      const entry: HintExplainEntry = {
        id: createEntryId(),
        mode,
        prompt: requestPrompt,
        answer: response.answer,
        source: response.source,
        timestamp: Date.now(),
      };
      pushHistory(entry);
      setError(null);
      setPrompt("");
    },
    [pushHistory]
  );

  const handlePatchSuccess = useCallback(
    (requestPrompt: string, response: AgentPatchResponse) => {
      const entry: PatchEntry = {
        id: createEntryId(),
        mode: "patch",
        prompt: requestPrompt,
        message: response.message,
        files: response.files ?? [],
        source: response.source,
        applied: false,
        timestamp: Date.now(),
      };
      pushHistory(entry);
      setError(null);
      setPrompt("");
    },
    [pushHistory]
  );

  const handleFailure = useCallback(
    (mode: AgentMode, requestPrompt: string, message: string) => {
      const entry: AgentHistoryEntry =
        mode === "patch"
          ? {
              id: createEntryId(),
              mode: "patch",
              prompt: requestPrompt,
              message,
              files: [],
              source: "error",
              error: message,
              applied: false,
              timestamp: Date.now(),
            }
          : {
              id: createEntryId(),
              mode,
              prompt: requestPrompt,
              source: "error",
              error: message,
              timestamp: Date.now(),
            };
      pushHistory(entry);
      setError(message);
    },
    [pushHistory]
  );

  const executeRequest = useCallback(
    async (mode: AgentMode, requestPrompt: string) => {
      if (!sessionId || !token) {
        setError("Sign in and start a session to chat with the agent.");
        return;
      }
      const trimmedPrompt = requestPrompt.trim();
      if (!trimmedPrompt) {
        setError("Enter a prompt first.");
        return;
      }
      if (loadingMode) {
        return;
      }

      const controller = new AbortController();
      setAbortController(controller);
      setLoadingMode(mode);
      setError(null);

      try {
        if (mode === "hint") {
          const response = await requestHint(sessionId, trimmedPrompt, labSlug, token);
          handleHintExplainSuccess("hint", trimmedPrompt, response);
        } else if (mode === "explain") {
          const response = await requestExplain(sessionId, trimmedPrompt, labSlug, token);
          handleHintExplainSuccess("explain", trimmedPrompt, response);
        } else {
          const response = await requestPatch(sessionId, trimmedPrompt, labSlug, token);
          handlePatchSuccess(trimmedPrompt, response);
        }
      } catch (err) {
        if (isAbortError(err)) {
          setError(null);
        } else {
          const message = err instanceof Error && err.message ? err.message : "Agent request failed. Please try again.";
          handleFailure(mode, trimmedPrompt, message);
        }
      } finally {
        setLoadingMode((current) => (current === mode ? null : current));
        setAbortController((current) => {
          if (current === controller) {
            return null;
          }
          return current;
        });
      }
    },
    [sessionId, token, loadingMode, labSlug, handleFailure, handleHintExplainSuccess, handlePatchSuccess]
  );

  const handleSend = useCallback(
    (mode: AgentMode) => {
      void executeRequest(mode, prompt);
    },
    [executeRequest, prompt]
  );

  const handleCancel = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setLoadingMode(null);
    }
  }, [abortController]);

  const handleResend = useCallback(
    (entry: AgentHistoryEntry) => {
      if (loadingMode) {
        return;
      }
      setPrompt(entry.prompt);
      void executeRequest(entry.mode, entry.prompt);
    },
    [executeRequest, loadingMode]
  );

  const handleCopyAnswer = useCallback((entry: HintExplainEntry) => {
    void copyToClipboard(entry.answer);
  }, []);

  const handleCopyPrompt = useCallback((entry: AgentHistoryEntry) => {
    void copyToClipboard(entry.prompt);
  }, []);

  const handleApplyPatch = useCallback(
    async (entryId: string) => {
      if (!sessionId || !token) {
        setError("Sign in and start a session before applying patches.");
        return;
      }
      const entry = history.find((item): item is PatchEntry => item.id === entryId && item.mode === "patch");
      if (!entry || entry.files.length === 0) {
        setError("Patch has no file changes to apply.");
        return;
      }
      setApplyingPatchId(entryId);
      setError(null);
      try {
        await applyPatch(sessionId, entry.files, token);
        setHistory((prev) =>
          prev.map((item) =>
            item.id === entryId && item.mode === "patch" ? { ...item, applied: true, applyError: undefined } : item
          )
        );
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : "Failed to apply patch.";
        setHistory((prev) =>
          prev.map((item) => (item.id === entryId && item.mode === "patch" ? { ...item, applyError: message } : item))
        );
        setError(message);
      } finally {
        setApplyingPatchId(null);
      }
    },
    [history, sessionId, token]
  );

  return (
    <CollapsiblePanel
      title="AI assistant"
      subtitle={statusText ?? "Ask for hints, explanations, or patch suggestions to unblock your lab."}
      defaultOpen
    >
      <div className="space-y-4 text-sm text-slate-200">
        <label className="flex flex-col gap-2 text-xs text-slate-300">
          Prompt
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.metaKey && event.key.toLowerCase() === "enter") {
                event.preventDefault();
                handleSend("hint");
              }
            }}
            rows={3}
            className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            placeholder="Explain what RUN does in a Dockerfile"
          />
        </label>
        {!sessionId && <p className="text-xs text-amber-200">Start a session to enable the agent.</p>}
        {sessionId && !token && <p className="text-xs text-amber-200">Sign in to chat with the agent.</p>}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            className="rounded-full border border-sky-400 px-3 py-2 font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleSend("hint")}
            disabled={disabled}
          >
            {loadingMode === "hint" ? "Sending..." : "Ask for hint"}
          </button>
          <button
            type="button"
            className="rounded-full border border-emerald-400 px-3 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleSend("explain")}
            disabled={disabled}
          >
            {loadingMode === "explain" ? "Sending..." : "Ask for explain"}
          </button>
          <button
            type="button"
            className="rounded-full border border-violet-400 px-3 py-2 font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleSend("patch")}
            disabled={disabled}
          >
            {loadingMode === "patch" ? "Requesting..." : "Suggest patch"}
          </button>
          {loadingMode && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-slate-600 px-3 py-2 font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Cancel
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">History</h3>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">No agent responses yet.</p>
          ) : (
            history.map((entry) => {
              if (entry.mode === "patch") {
                return (
                  <div
                    key={entry.id}
                    className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-200"
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                      <span>Patch suggestion</span>
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
                    <p className="text-slate-400">
                      <span className="font-semibold text-slate-300">You:</span> {entry.prompt}
                    </p>
                    <p className="whitespace-pre-wrap text-slate-100">{entry.message}</p>
                    {entry.files.length > 0 ? (
                      <ul className="space-y-3">
                        {entry.files.map((file) => (
                          <li key={`${entry.id}-${file.path}`} className="rounded border border-white/5 bg-slate-900/60 p-3">
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                              <code className="text-slate-200">{file.path}</code>
                              {file.description && <span className="text-slate-500">{file.description}</span>}
                            </div>
                            <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-950/80 p-3 text-[11px] text-slate-200">
                              {file.content}
                            </pre>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">No concrete file changes provided.</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        className="rounded-full border border-slate-600 px-2 py-1 text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleResend(entry)}
                        disabled={Boolean(loadingMode)}
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-600 px-2 py-1 text-slate-200 transition hover:bg-slate-800"
                        onClick={() => handleCopyPrompt(entry)}
                      >
                        Copy prompt
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-emerald-600 px-2 py-1 text-emerald-200 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleApplyPatch(entry.id)}
                        disabled={
                          entry.files.length === 0 ||
                          !token ||
                          !sessionId ||
                          entry.applied ||
                          applyingPatchId === entry.id
                        }
                      >
                        {entry.applied ? "Applied" : applyingPatchId === entry.id ? "Applying..." : "Apply patch"}
                      </button>
                      {entry.applyError && <span className="text-red-300">{entry.applyError}</span>}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-200"
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
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-200">You:</span> {entry.prompt}
                  </p>
                  {entry.answer && (
                    <p className="mt-2 whitespace-pre-wrap text-slate-100">{entry.answer}</p>
                  )}
                  {entry.error && <p className="mt-2 text-red-300">{entry.error}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      className="rounded-full border border-slate-600 px-2 py-1 text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => handleResend(entry)}
                      disabled={Boolean(loadingMode)}
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-slate-600 px-2 py-1 text-slate-200 transition hover:bg-slate-800"
                      onClick={() => handleCopyPrompt(entry)}
                    >
                      Copy prompt
                    </button>
                    {entry.answer && (
                      <button
                        type="button"
                        className="rounded-full border border-slate-600 px-2 py-1 text-slate-200 transition hover:bg-slate-800"
                        onClick={() => handleCopyAnswer(entry)}
                      >
                        Copy answer
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </CollapsiblePanel>
  );
}
