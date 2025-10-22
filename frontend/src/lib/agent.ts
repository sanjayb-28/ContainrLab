import { apiPost } from "@/lib/api";

export type AgentResponse = {
  session_id: string;
  prompt: string;
  answer: string;
  source: string;
};

type AgentRequestPayload = {
  session_id: string;
  prompt: string;
  lab_slug?: string | null;
};

function buildPayload(sessionId: string, prompt: string, labSlug?: string): AgentRequestPayload {
  return {
    session_id: sessionId,
    prompt,
    lab_slug: labSlug ?? undefined,
  };
}

export async function requestHint(
  sessionId: string,
  prompt: string,
  labSlug?: string,
  init?: RequestInit
): Promise<AgentResponse> {
  return apiPost("/agent/hint", buildPayload(sessionId, prompt, labSlug), init);
}

export async function requestExplain(
  sessionId: string,
  prompt: string,
  labSlug?: string,
  init?: RequestInit
): Promise<AgentResponse> {
  return apiPost("/agent/explain", buildPayload(sessionId, prompt, labSlug), init);
}
