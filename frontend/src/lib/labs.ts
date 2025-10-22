import { apiGet } from "./api";

export type LabSummary = {
  slug: string;
  title: string;
  summary?: string | null;
  has_starter: boolean;
};

export type LabDetail = LabSummary & {
  readme: string;
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
  attempts: SessionAttempt[];
};

export type InspectorSummary = {
  session_id: string;
  attempt_count: number;
  last_attempt_at?: string | null;
  last_passed?: boolean | null;
  metrics: Record<string, unknown>;
};

export async function fetchLabs(): Promise<LabSummary[]> {
  return apiGet("/labs");
}

export async function fetchLab(slug: string): Promise<LabDetail> {
  return apiGet(`/labs/${slug}`);
}

export async function fetchSession(sessionId: string): Promise<SessionDetail> {
  return apiGet(`/sessions/${sessionId}`);
}

export async function fetchInspector(sessionId: string): Promise<InspectorSummary> {
  return apiGet(`/sessions/${sessionId}/inspector`);
}
