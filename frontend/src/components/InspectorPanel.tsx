"use client";

import { useAuth } from "@/components/AuthProvider";
import { useLabSession } from "@/components/LabSessionProvider";
import CollapsiblePanel from "@/components/ui/CollapsiblePanel";
import { fetchInspector, type InspectorSummary, type InspectorTimelineEntry } from "@/lib/labs";
import { useCallback, useEffect, useMemo, useState } from "react";

type MetricRow = {
  label: string;
  path: string;
  display: string;
  delta?: number;
};

type TimelineRow = InspectorTimelineEntry & {
  metrics_display: MetricRow[];
};

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

  const timeline = useMemo(() => (summary ? buildTimeline(summary.timeline ?? []) : []), [summary]);

  if (!sessionId) {
    return (
      <CollapsiblePanel title="Inspector" defaultOpen>
        <p className="text-sm text-slate-500">Start a session to view build metrics.</p>
      </CollapsiblePanel>
    );
  }

  if (!token) {
    return (
      <CollapsiblePanel title="Inspector" defaultOpen>
        <p className="text-sm text-slate-500">Sign in to load inspector metrics.</p>
      </CollapsiblePanel>
    );
  }

  if (loading && !summary) {
    return (
      <CollapsiblePanel title="Inspector" defaultOpen>
        <p className="text-sm text-slate-400">Loading build metrics...</p>
      </CollapsiblePanel>
    );
  }

  if (error) {
    return (
      <CollapsiblePanel title="Inspector" defaultOpen>
        <p className="text-sm text-red-300">{error}</p>
      </CollapsiblePanel>
    );
  }

  if (!summary) {
    return (
      <CollapsiblePanel title="Inspector" defaultOpen>
        <p className="text-sm text-slate-500">No attempts yet.</p>
      </CollapsiblePanel>
    );
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
    <CollapsiblePanel
      title="Inspector"
      actions={
        sessionId && token ? (
          <button
            type="button"
            onClick={() => sessionId && load(sessionId)}
            disabled={loading}
            className="rounded-full border border-slate-500 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-700/40 disabled:cursor-not-allowed"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        ) : undefined
      }
    >
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
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
              <p className="font-semibold uppercase tracking-wide text-slate-400">Latest build metrics</p>
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

      {timeline.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">Attempt timeline</h3>
            <span className="text-xs text-slate-500">Newest first</span>
          </div>
          <ul className="space-y-3">
            {timeline.map((entry) => (
              <li key={entry.attempt_id} className="space-y-2 rounded bg-slate-900/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-200">Attempt #{entry.attempt_id}</span>
                  <span className={entry.passed ? "text-emerald-300" : "text-amber-200"}>
                    {entry.passed ? "Passed" : "Failed"}
                  </span>
                  <span className="text-slate-500">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                {entry.metrics_display.length > 0 && (
                  <ul className="grid gap-2 text-xs md:grid-cols-2">
                    {entry.metrics_display.map((metric) => (
                      <li key={metric.path} className="flex justify-between rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
                        <span className="text-slate-300">{metric.label}</span>
                        <span className="text-right text-slate-100">
                          <span>{metric.display}</span>
                          {formatDelta(metric.delta)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {entry.notes && Object.keys(entry.notes).length > 0 && (
                  <div className="text-xs text-slate-400">
                    <p className="font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-950/80 p-3 text-xs text-slate-200">
                      {JSON.stringify(entry.notes, null, 2)}
                    </pre>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </CollapsiblePanel>
  );
}

function buildTimeline(entries: InspectorTimelineEntry[]): TimelineRow[] {
  return entries.map((entry) => {
    const metricsDisplay: MetricRow[] = [];
    if (typeof entry.metrics.elapsed_seconds === "number") {
      metricsDisplay.push({
        label: "Build time",
        path: "elapsed_seconds",
        display: `${entry.metrics.elapsed_seconds.toFixed(2)} s`,
        delta: entry.deltas?.elapsed_seconds,
      });
    }
    if (typeof entry.metrics.image_size_mb === "number") {
      metricsDisplay.push({
        label: "Image size",
        path: "image_size_mb",
        display: `${entry.metrics.image_size_mb.toFixed(2)} MB`,
        delta: entry.deltas?.image_size_mb,
      });
    }
    if (typeof entry.metrics.cache_hits === "number") {
      metricsDisplay.push({
        label: "Cache hits",
        path: "cache_hits",
        display: entry.metrics.cache_hits.toString(),
        delta: entry.deltas?.cache_hits,
      });
    }
    if (typeof entry.metrics.layer_count === "number") {
      metricsDisplay.push({
        label: "Layers",
        path: "layer_count",
        display: entry.metrics.layer_count.toString(),
        delta: entry.deltas?.layer_count,
      });
    }
    return { ...entry, metrics_display: metricsDisplay };
  });
}

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
