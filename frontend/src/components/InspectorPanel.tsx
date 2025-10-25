"use client";

import { useAuth } from "@/components/AuthProvider";
import { useLabSession } from "@/components/LabSessionProvider";
import { fetchInspector, type InspectorSummary } from "@/lib/labs";
import { useCallback, useEffect, useState } from "react";

type MetricRow = {
  label: string;
  path: string;
  display: string;
  delta?: number;
};

function getNestedNumber(metrics: Record<string, unknown> | undefined, path: string): number | undefined {
  if (!metrics) {
    return undefined;
  }
  const segments = path.split(".");
  let current: unknown = metrics;
  for (const segment of segments) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return typeof current === "number" ? (current as number) : undefined;
}

function formatDelta(delta?: number): JSX.Element | null {
  if (!delta) {
    return null;
  }
  const sign = delta > 0 ? "+" : "";
  const trend = delta > 0 ? "▲" : "▼";
  return (
    <span className={delta > 0 ? "text-amber-300" : "text-emerald-300"}>
      {trend} {sign}
      {delta.toFixed(2)}
    </span>
  );
}

export default function InspectorPanel() {
  const { token } = useAuth();
  const { sessionId } = useLabSession();
  const [summary, setSummary] = useState<InspectorSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (id: string) => {
      if (!token) {
        setSummary(null);
        setError("Sign in to view inspector metrics.");
        return;
      }
      setLoading(true);
      try {
        const data = await fetchInspector(id, token);
        setSummary(data);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Inspector unavailable";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!sessionId) {
      setSummary(null);
      setError(null);
      return;
    }
    void load(sessionId);
  }, [load, sessionId]);

  if (!sessionId) {
    return <p className="text-sm text-slate-500">Start a session to view build metrics.</p>;
  }

  if (!token) {
    return <p className="text-sm text-slate-500">Sign in to load inspector metrics.</p>;
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

  const buildMetrics = (summary.metrics?.build ?? {}) as Record<string, unknown>;
  const deltas = summary.metric_deltas ?? {};

  const metricRows: MetricRow[] = [];

  const buildSeconds =
    typeof buildMetrics.elapsed_seconds === "number"
      ? (buildMetrics.elapsed_seconds as number)
      : getNestedNumber(summary.metrics as Record<string, unknown>, "build.elapsed_seconds");
  if (typeof buildSeconds === "number") {
    metricRows.push({
      label: "Build time",
      path: "build.elapsed_seconds",
      display: `${buildSeconds.toFixed(2)} s`,
      delta: deltas["build.elapsed_seconds"],
    });
  }

  const imageSize =
    typeof buildMetrics.image_size_mb === "number"
      ? (buildMetrics.image_size_mb as number)
      : getNestedNumber(summary.metrics as Record<string, unknown>, "build.image_size_mb");
  if (typeof imageSize === "number") {
    metricRows.push({
      label: "Image size",
      path: "build.image_size_mb",
      display: `${imageSize.toFixed(2)} MB`,
      delta: deltas["build.image_size_mb"],
    });
  }

  const cacheHits =
    typeof buildMetrics.cache_hits === "number"
      ? (buildMetrics.cache_hits as number)
      : getNestedNumber(summary.metrics as Record<string, unknown>, "build.cache_hits");
  if (typeof cacheHits === "number") {
    metricRows.push({
      label: "Cache hits",
      path: "build.cache_hits",
      display: cacheHits.toString(),
      delta: deltas["build.cache_hits"],
    });
  }

  const layerCount =
    typeof buildMetrics.layer_count === "number"
      ? (buildMetrics.layer_count as number)
      : getNestedNumber(summary.metrics as Record<string, unknown>, "build.layer_count");
  if (typeof layerCount === "number") {
    metricRows.push({
      label: "Layer count",
      path: "build.layer_count",
      display: layerCount.toString(),
      delta: deltas["build.layer_count"],
    });
  }

  const layerList = Array.isArray(buildMetrics.layers)
    ? (buildMetrics.layers as Array<Record<string, unknown>>)
    : [];

  const previousExists = Boolean(summary.previous_metrics);

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
            <dd>{summary.last_attempt_at ? new Date(summary.last_attempt_at).toLocaleString() : "n/a"}</dd>
          </div>
        </dl>

        {metricRows.length > 0 && (
          <div className="mt-4 space-y-3 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <p className="font-semibold uppercase tracking-wide text-slate-400">Build Metrics</p>
              {previousExists && <span className="text-[11px] text-slate-500">Compared with previous attempt</span>}
            </div>
            <ul className="space-y-2">
              {metricRows.map((row) => (
                <li key={row.path} className="flex justify-between rounded bg-slate-900/60 px-3 py-2">
                  <span className="text-slate-300">{row.label}</span>
                  <span className="text-right text-slate-100">
                    <span>{row.display}</span>
                    {formatDelta(row.delta)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {layerList.length > 0 && (
          <div className="mt-4 space-y-2 text-xs text-slate-300">
            <p className="font-semibold uppercase tracking-wide text-slate-400">Layers</p>
            <ul className="space-y-1 max-h-48 overflow-auto rounded border border-slate-800 bg-slate-900/60 p-3">
              {layerList.slice(0, 8).map((layer, index) => {
                const layerId = typeof layer.id === "string" ? layer.id : `layer-${index}`;
                const createdBy = typeof layer.created_by === "string" ? layer.created_by : undefined;
                const sizeMb = typeof layer.size_mb === "number" ? (layer.size_mb as number) : undefined;
                return (
                  <li key={`${layerId}-${index}`} className="flex flex-col gap-1">
                    <span className="text-slate-400 text-[11px]">{layerId}</span>
                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                      {typeof sizeMb === "number" && <span>{sizeMb.toFixed(2)} MB</span>}
                      {createdBy && <span className="text-slate-500">{createdBy}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
