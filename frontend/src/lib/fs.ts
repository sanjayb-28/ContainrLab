import { apiGet, apiPost } from "@/lib/api";

type FsEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number | null;
  modified?: number | null;
};

export type ListResponse = {
  path: string;
  entries: FsEntry[];
};

export async function listPath(sessionId: string, path?: string): Promise<ListResponse> {
  const params = new URLSearchParams();
  if (path) {
    params.set("path", path);
  }
  return apiGet(`/fs/${sessionId}/list?${params.toString()}`);
}

export type ReadResponse = {
  path: string;
  encoding: string;
  content: string;
};

export async function readFile(sessionId: string, path: string): Promise<ReadResponse> {
  return apiGet(`/fs/${sessionId}/read?path=${encodeURIComponent(path)}`);
}

export async function writeFile(
  sessionId: string,
  path: string,
  contentBase64: string
): Promise<void> {
  await apiPost(`/fs/write`, {
    session_id: sessionId,
    path,
    content: contentBase64,
    encoding: "base64",
  });
}

export function encodeToBase64(text: string): string {
  return typeof window === "undefined"
    ? Buffer.from(text, "utf-8").toString("base64")
    : window.btoa(unescape(encodeURIComponent(text)));
}

export function decodeFromBase64(b64: string): string {
  return typeof window === "undefined"
    ? Buffer.from(b64, "base64").toString("utf-8")
    : decodeURIComponent(escape(window.atob(b64)));
}
