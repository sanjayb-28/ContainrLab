"use client";

import { useState } from "react";
import { requestExplain, requestHint } from "@/lib/agent";

export default function AgentDrawer({ sessionId }: { sessionId?: string }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !sessionId || loading;

  const sendRequest = async (mode: "hint" | "explain") => {
    if (!sessionId) {
      return;
    }
    if (!prompt.trim()) {
      setError("Enter a prompt first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response =
        mode === "hint"
          ? await requestHint(sessionId, prompt)
          : await requestExplain(sessionId, prompt);
      setAnswer(response.answer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Agent request failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <button
        type="button"
        className="mb-3 text-sm font-semibold text-sky-400 hover:text-sky-300"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "Close Agent" : "Open Agent"}
      </button>
      {open && (
        <div className="space-y-3 text-sm text-slate-200">
          {!sessionId && (
            <p className="text-slate-500">Start a session to chat with the agent.</p>
          )}
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask for a hint or explanation..."
            className="h-24 w-full rounded border border-slate-800 bg-slate-950 p-2 text-slate-100 placeholder:text-slate-500"
            disabled={disabled}
          />
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => sendRequest("hint")}
              disabled={disabled}
            >
              {loading ? "Sending..." : "Ask for hint"}
            </button>
            <button
              type="button"
              className="rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => sendRequest("explain")}
              disabled={disabled}
            >
              {loading ? "Sending..." : "Ask for explain"}
            </button>
          </div>
          {error && <p className="text-red-300">{error}</p>}
          {answer && (
            <div className="rounded border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200">
              {answer}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
