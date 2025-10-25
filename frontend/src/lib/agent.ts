import { apiPost } from "@/lib/api";

export type AgentResponse = {
  session_id: string;
  prompt: string;
  answer: string;
  source: string;
};

export type AgentPatchFile = {
  path: string;
  content: string;
  description?: string | null;
};

export type AgentPatchResponse = {
  session_id: string;
  prompt: string;
  message: string;
  files: AgentPatchFile[];
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
  token?: string
): Promise<AgentResponse> {
  return apiPost("/agent/hint", buildPayload(sessionId, prompt, labSlug), { token });
}

export async function requestExplain(
  sessionId: string,
  prompt: string,
  labSlug?: string,
  token?: string
): Promise<AgentResponse> {
  return apiPost("/agent/explain", buildPayload(sessionId, prompt, labSlug), { token });
}

export async function requestPatch(
  sessionId: string,
  prompt: string,
  labSlug?: string,
  token?: string
): Promise<AgentPatchResponse> {
  return apiPost("/agent/patch", buildPayload(sessionId, prompt, labSlug), { token });
}

export async function applyPatch(
  sessionId: string,
  files: AgentPatchFile[],
  token?: string
): Promise<{ session_id: string; applied: string[] }> {
  return apiPost("/agent/patch/apply", { session_id: sessionId, files }, { token });
}
