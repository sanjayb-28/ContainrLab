import { apiGet, apiPost } from "./api";

export type LabSummary = {
  slug: string;
  title: string;
  summary?: string | null;
  has_starter: boolean;
};

export type LabDetail = LabSummary & {
  description: string;
  solution?: string | null;
};

export type SessionAttempt = {
  id: number;
  lab_slug: string;
  created_at: string;
  passed: boolean;
  failures: Array<{ code: string; message: string; hint?: string | null }>;
  metrics: Record<string, unknown>;
  notes: Record<string, unknown>;
};

export type SessionDetail = {
  session_id: string;
  lab_slug: string;
  runner_container: string;
  ttl_seconds: number;
  created_at: string;
  expires_at: string;
  ended_at?: string | null;
  attempts: SessionAttempt[];
};

export type InspectorSummary = {
  session_id: string;
  attempt_count: number;
  last_attempt_at?: string | null;
  last_passed?: boolean | null;
  metrics: Record<string, unknown>;
  previous_metrics?: Record<string, unknown> | null;
  metric_deltas?: Record<string, number>;
  timeline?: InspectorTimelineEntry[];
};

export type InspectorTimelineEntry = {
  attempt_id: number;
  created_at: string;
  passed: boolean;
  metrics: {
    elapsed_seconds?: number;
    image_size_mb?: number;
    cache_hits?: number;
    layer_count?: number;
    [key: string]: number | undefined;
  };
  deltas?: Record<string, number>;
  notes?: Record<string, unknown>;
};

export async function fetchLabs(): Promise<LabSummary[]> {
  return apiGet("/labs");
}

export async function fetchLab(slug: string): Promise<LabDetail> {
  return apiGet(`/labs/${slug}`);
}

export type ActiveLabSession = {
  session_id: string;
  ttl: number;
  runner_container: string;
  created_at: string;
  expires_at: string;
  ended_at?: string | null;
};

export async function fetchActiveLabSession(labSlug: string, token: string): Promise<ActiveLabSession> {
  return apiGet(`/labs/${labSlug}/session`, { token });
}

export async function fetchSession(sessionId: string, token: string, limit?: number): Promise<SessionDetail> {
  const params = limit && limit > 0 ? `?limit=${limit}` : "";
  return apiGet(`/sessions/${sessionId}${params}`, { token });
}

export async function fetchInspector(sessionId: string, token: string): Promise<InspectorSummary> {
  return apiGet(`/sessions/${sessionId}/inspector`, { token });
}

export type BuildResponse = {
  image_tag: string;
  logs: string[];
  metrics: Record<string, unknown>;
};

export async function buildSession(
  sessionId: string,
  token: string,
  options: {
    contextPath?: string;
    dockerfilePath?: string;
  } = {}
): Promise<BuildResponse> {
  const { contextPath = "/workspace", dockerfilePath = "Dockerfile" } = options;
  return apiPost(`/sessions/${sessionId}/build`, {
    context_path: contextPath,
    dockerfile_path: dockerfilePath,
  }, { token });
}
