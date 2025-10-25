const FALLBACK_API_BASE = "http://localhost:8000";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || FALLBACK_API_BASE;

type ApiOptions = RequestInit & { token?: string };

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

function mergeHeaders(initHeaders: HeadersInit | undefined, token?: string): HeadersInit {
  const headers = new Headers(initHeaders || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function apiGet<T>(path: string, options?: ApiOptions): Promise<T> {
  const { token, headers, ...rest } = options ?? {};
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...rest,
    headers: mergeHeaders(headers, token),
  });
  return handleJsonResponse(response);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: ApiOptions
): Promise<T> {
  const { token, headers, ...rest } = options ?? {};
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...mergeHeaders(headers, token),
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
    ...rest,
  });
  return handleJsonResponse(response);
}
