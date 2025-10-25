import { apiGet, apiPost } from "@/lib/api";

export type FsEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number | null;
  modified?: number | null;
};

export type ListResponse = {
  path: string;
  entries: FsEntry[];
  exists: boolean;
  is_dir: boolean;
};

export async function listPath(sessionId: string, path?: string, token?: string): Promise<ListResponse> {
  const params = new URLSearchParams();
  if (path) {
    params.set("path", path);
  }
  return apiGet(`/fs/${sessionId}/list?${params.toString()}`, { token });
}

export type ReadResponse = {
  path: string;
  encoding: string;
  content: string;
};

export async function readFile(sessionId: string, path: string, token?: string): Promise<ReadResponse> {
  return apiGet(`/fs/${sessionId}/read?path=${encodeURIComponent(path)}`, { token });
}

export async function writeFile(
  sessionId: string,
  path: string,
  contentBase64: string,
  token?: string
): Promise<void> {
  await apiPost(`/fs/write`, {
    session_id: sessionId,
    path,
    content: contentBase64,
    encoding: "base64",
  }, { token });
}

export async function createEntry(
  sessionId: string,
  path: string,
  kind: "file" | "directory",
  contentBase64?: string,
  token?: string
): Promise<void> {
  await apiPost(`/fs/create`, {
    session_id: sessionId,
    path,
    kind,
    content: kind === "file" ? contentBase64 ?? "" : undefined,
    encoding: "base64",
  }, { token });
}

export async function renameEntry(
  sessionId: string,
  path: string,
  newPath: string,
  token?: string
): Promise<void> {
  await apiPost(`/fs/rename`, {
    session_id: sessionId,
    path,
    new_path: newPath,
  }, { token });
}

export async function deleteEntry(sessionId: string, path: string, token?: string): Promise<void> {
  await apiPost(`/fs/delete`, {
    session_id: sessionId,
    path,
  }, { token });
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
