const FALLBACK_API_BASE = "http://localhost:8000";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || FALLBACK_API_BASE;

async function handleJsonResponse(response: Response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `Request failed with status ${response.status}`
    );
    (error as any).status = response.status;
    (error as any).payload = payload;
    throw error;
  }
  return payload;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
  });
  return handleJsonResponse(response);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
    ...init,
  });
  return handleJsonResponse(response);
}
