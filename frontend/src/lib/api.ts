const FALLBACK_API_BASE = "http://localhost:8000";

const PUBLIC_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || FALLBACK_API_BASE;

const INTERNAL_API_BASE =
  process.env.API_INTERNAL_BASE?.replace(/\/$/, "") || PUBLIC_API_BASE;

export const DISPLAY_API_BASE = PUBLIC_API_BASE;

export const API_BASE =
  typeof window === "undefined" ? INTERNAL_API_BASE : PUBLIC_API_BASE;

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

function mergeHeaders(initHeaders: HeadersInit | undefined, token?: string): Headers {
  const headers = new Headers(initHeaders || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function apiGet<T>(path: string, options?: ApiOptions): Promise<T> {
  const { token, headers: initHeaders, ...rest } = options ?? {};
  const requestHeaders = mergeHeaders(initHeaders, token);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...rest,
      headers: requestHeaders,
    });
    return handleJsonResponse(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Unable to reach the ContainrLab API at ${DISPLAY_API_BASE}. Is the backend running?`,
        { cause: error }
      );
    }
    throw error;
  }
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: ApiOptions
): Promise<T> {
  const { token, headers: initHeaders, ...rest } = options ?? {};
  const requestHeaders = mergeHeaders(initHeaders, token);
  requestHeaders.set("Content-Type", "application/json");
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
      ...rest,
    });
    return handleJsonResponse(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Unable to reach the ContainrLab API at ${DISPLAY_API_BASE}. Is the backend running?`,
        { cause: error }
      );
    }
    throw error;
  }
}
