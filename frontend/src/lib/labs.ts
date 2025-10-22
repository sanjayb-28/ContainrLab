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

export async function fetchLabs(): Promise<LabSummary[]> {
  return apiGet("/labs");
}

export async function fetchLab(slug: string): Promise<LabDetail> {
  return apiGet(`/labs/${slug}`);
}

export async function fetchSession(sessionId: string): Promise<SessionDetail> {
  return apiGet(`/sessions/${sessionId}`);
}
