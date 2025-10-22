"use client";

import { useEffect, useState } from "react";
import { fetchInspector, type InspectorSummary } from "@/lib/labs";

export default function InspectorPanel({ sessionId }: { sessionId?: string }) {
  const [summary, setSummary] = useState<InspectorSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (id: string) => {
    setLoading(true);
    try {
      const data = await fetchInspector(id);
      setSummary(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Inspector unavailable";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) {
      setSummary(null);
      setError(null);
      return;
    }
    load(sessionId);
  }, [sessionId]);

  if (!sessionId) {
    return <p className="text-sm text-slate-500">Start a session to view build metrics.</p>;
  }

  if (loading && !summary) {
    return <p className="text-sm text-slate-400">Loading build metrics...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!summary) {
    return <p className="text-sm text-slate-500">No attempts yet.</p>;
  }

  const lastPassedText =
    summary.last_passed === null || summary.last_passed === undefined
      ? "n/a"
      : summary.last_passed
      ? "Yes"
      : "No";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Inspector</h2>
        <button
          type="button"
          onClick={() => sessionId && load(sessionId)}
          disabled={loading}
          className="rounded bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600 disabled:cursor-not-allowed"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div className="rounded border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
        <dl className="grid gap-2">
          <div className="flex justify-between">
            <dt className="text-slate-400">Attempts</dt>
            <dd>{summary.attempt_count}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Last passed</dt>
            <dd>{lastPassedText}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Last attempt</dt>
            <dd>
              {summary.last_attempt_at
                ? new Date(summary.last_attempt_at).toLocaleString()
                : "n/a"}
            </dd>
          </div>
        </dl>
        {Object.keys(summary.metrics ?? {}).length > 0 && (
          <div className="mt-4 text-xs text-slate-300">
            <p className="mb-1 font-semibold uppercase tracking-wide text-slate-400">
              Metrics
            </p>
            <pre className="overflow-auto rounded bg-slate-900/80 p-3 text-xs">
              {JSON.stringify(summary.metrics, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
