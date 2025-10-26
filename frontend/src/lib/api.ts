const FALLBACK_API_BASE = "http://localhost:8000";

const PUBLIC_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || FALLBACK_API_BASE;

const INTERNAL_API_BASE =
  process.env.API_INTERNAL_BASE?.replace(/\/$/, "") || PUBLIC_API_BASE;

export const DISPLAY_API_BASE = PUBLIC_API_BASE;

export const API_BASE =
  typeof window === "undefined" ? INTERNAL_API_BASE : PUBLIC_API_BASE;

type ApiOptions = RequestInit & { token?: string };

type HeaderRecord = Record<string, string>;

function toHeaderRecord(initHeaders?: HeadersInit): HeaderRecord {
  const headers: HeaderRecord = {};
  if (!initHeaders) {
    return headers;
  }
  if (typeof Headers !== "undefined" && initHeaders instanceof Headers) {
    initHeaders.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
  if (Array.isArray(initHeaders)) {
    for (const [key, value] of initHeaders) {
      headers[key] = value;
    }
    return headers;
  }
  Object.entries(initHeaders as Record<string, string>).forEach(([key, value]) => {
    headers[key] = value;
  });
  return headers;
}

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

export async function apiGet<T>(path: string, options?: ApiOptions): Promise<T> {
  const { token, headers: initHeaders, ...rest } = options ?? {};
  const requestHeaders = toHeaderRecord(initHeaders);
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }
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
  const requestHeaders = toHeaderRecord(initHeaders);
  requestHeaders["Content-Type"] = "application/json";
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }
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
