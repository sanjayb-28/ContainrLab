import { apiPost } from "@/lib/api";

type AgentPayload = {
  session_id: string;
  prompt: string;
};

type AgentResponse = {
  session_id: string;
  prompt: string;
  answer: string;
  source: string;
};

export async function requestHint(sessionId: string, prompt: string): Promise<AgentResponse> {
  return apiPost("/agent/hint", { session_id: sessionId, prompt });
}

export async function requestExplain(sessionId: string, prompt: string): Promise<AgentResponse> {
  return apiPost("/agent/explain", { session_id: sessionId, prompt });
}
