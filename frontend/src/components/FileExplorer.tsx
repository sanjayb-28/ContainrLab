"use client";

import {
  createEntry,
  deleteEntry,
  FsEntry,
  listPath,
  renameEntry,
} from "@/lib/fs";
import { useAuth } from "@/components/AuthProvider";
import { useLabSession } from "@/components/LabSessionProvider";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

const WORKSPACE_ROOT = "/workspace";

type EntryKind = "file" | "directory";

type EntryMap = Record<string, FsEntry[]>;

export type FileExplorerHandle = {
  refresh: (path?: string) => Promise<void>;
};

export type FileExplorerProps = {
  activeFile?: string;
  activeDirectory: string;
  dirtyPaths: Set<string>;
  onSelectFile: (path: string) => void;
  onSelectDirectory: (path: string) => void;
  onEntryCreated: (path: string, kind: EntryKind) => void;
  onEntryRenamed: (oldPath: string, newPath: string) => void;
  onEntryDeleted: (path: string) => void;
};

function parentPath(path: string): string {
  if (!path || path === WORKSPACE_ROOT) {
    return WORKSPACE_ROOT;
  }
  const trimmed = path.replace(/\/$/, "");
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash <= 0) {
    return WORKSPACE_ROOT;
  }
  const parent = trimmed.slice(0, lastSlash);
  return parent || WORKSPACE_ROOT;
}

function joinPath(directory: string, name: string): string {
  const base = directory.endsWith("/") ? directory.slice(0, -1) : directory;
  return `${base}/${name}`;
}

function isDescendent(base: string, candidate: string): boolean {
  if (base === candidate) {
    return true;
  }
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return candidate.startsWith(prefix);
}

function formatDirtyIndicator(dirtyPaths: Set<string>, entryPath: string, isDirectory: boolean): boolean {
  if (dirtyPaths.has(entryPath)) {
    return true;
  }
  if (!isDirectory) {
    return false;
  }
  let descendantDirty = false;
  dirtyPaths.forEach((dirty) => {
    if (!descendantDirty && isDescendent(entryPath, dirty)) {
      descendantDirty = true;
    }
  });
  return descendantDirty;
}

const FileExplorer = forwardRef<FileExplorerHandle, FileExplorerProps>(
  (
    { activeFile, activeDirectory, dirtyPaths, onSelectFile, onSelectDirectory, onEntryCreated, onEntryRenamed, onEntryDeleted },
    ref
  ) => {
    const { token } = useAuth();
    const { sessionId } = useLabSession();
    const [entriesByPath, setEntriesByPath] = useState<EntryMap>({});
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([WORKSPACE_ROOT]));
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const sessionRef = useRef<string | null>(null);
    sessionRef.current = sessionId ?? null;

    const setLoading = useCallback((path: string, next: boolean) => {
      setLoadingPaths((prev) => {
        const updated = new Set(prev);
        if (next) {
          updated.add(path);
        } else {
          updated.delete(path);
        }
        return updated;
      });
    }, []);

    const updateEntryMap = useCallback((path: string, entries: FsEntry[]) => {
      setEntriesByPath((prev) => ({
        ...prev,
        [path]: entries,
      }));
    }, []);

    const removeEntryTree = useCallback((target: string) => {
      setEntriesByPath((prev) => {
        const next: EntryMap = {};
        const prefix = target.endsWith("/") ? target : `${target}/`;
        for (const [key, value] of Object.entries(prev)) {
          if (key === target || key.startsWith(prefix)) {
            continue;
          }
          next[key] = value;
        }
        return next;
      });
    }, []);

    const fetchEntries = useCallback(
      async (path: string): Promise<void> => {
        if (!sessionId) {
          setEntriesByPath({});
          setError("Start a session to browse files.");
          return;
        }
        if (!token) {
          setEntriesByPath({});
          setError("Sign in to access the workspace explorer.");
          return;
        }
        setLoading(path, true);
        try {
          const response = await listPath(sessionId, path === WORKSPACE_ROOT ? undefined : path, token);
          if (sessionRef.current !== sessionId) {
            return;
          }
          updateEntryMap(response.path, response.entries);
          setError(null);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to list files";
          setError(message);
        } finally {
          setLoading(path, false);
        }
      },
      [sessionId, token, setLoading, updateEntryMap]
    );

    useEffect(() => {
      setEntriesByPath({});
      setExpandedPaths(new Set([WORKSPACE_ROOT]));
      setError(null);
      if (sessionId && token) {
        void fetchEntries(WORKSPACE_ROOT);
      }
    }, [fetchEntries, sessionId, token]);

    useImperativeHandle(
      ref,
      () => ({
        async refresh(path?: string) {
          const target = path ?? WORKSPACE_ROOT;
          await fetchEntries(target);
        },
      }),
      [fetchEntries]
    );

    const toggleDirectory = useCallback(
      (path: string) => {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          if (next.has(path)) {
            next.delete(path);
          } else {
            next.add(path);
            if (!entriesByPath[path]) {
              void fetchEntries(path);
            }
          }
          return next;
        });
      },
      [entriesByPath, fetchEntries]
    );

    const handleCreate = useCallback(
      async (kind: EntryKind, directory: string) => {
        if (!sessionId || !token) {
          setError("Sign in and start a session before creating files.");
          return;
        }
        const normalized = kind === "file" ? joinPath(directory, "new-file.txt") : joinPath(directory, "new-directory");
        try {
          if (kind === "file") {
            await createEntry(sessionId, normalized, "file", "", token);
          } else {
            await createEntry(sessionId, normalized, "directory", undefined, token);
          }
          removeEntryTree(directory);
          await fetchEntries(directory);
          onEntryCreated(normalized, kind);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create entry";
          setError(message);
        }
      },
      [fetchEntries, onEntryCreated, removeEntryTree, sessionId, token]
    );

    const handleRename = useCallback(
      async (source: string, destination: string) => {
        if (!sessionId || !token) {
          setError("Sign in and start a session before renaming files.");
          return;
        }
        try {
          await renameEntry(sessionId, source, destination, token);
          removeEntryTree(parentPath(source));
          await fetchEntries(parentPath(destination));
          onEntryRenamed(source, destination);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to rename entry";
          setError(message);
        }
      },
      [fetchEntries, onEntryRenamed, removeEntryTree, sessionId, token]
    );

    const handleDelete = useCallback(
      async (target: string) => {
        if (!sessionId || !token) {
          setError("Sign in and start a session before deleting files.");
          return;
        }
        try {
          await deleteEntry(sessionId, target, token);
          removeEntryTree(target);
          await fetchEntries(parentPath(target));
          onEntryDeleted(target);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete entry";
          setError(message);
        }
      },
      [fetchEntries, onEntryDeleted, removeEntryTree, sessionId, token]
    );

    const currentEntries = entriesByPath[activeDirectory] ?? [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Explorer</h3>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => handleCreate("file", activeDirectory)}
              disabled={!sessionId || !token}
            >
              + File
            </button>
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => handleCreate("directory", activeDirectory)}
              disabled={!sessionId || !token}
            >
              + Folder
            </button>
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => fetchEntries(activeDirectory)}
              disabled={!sessionId || !token}
            >
              Refresh
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <ul className="space-y-1 text-sm">
          {currentEntries.map((entry) => {
            const isDirectory = entry.is_dir;
            const dirty = formatDirtyIndicator(dirtyPaths, entry.path, isDirectory);
            const isLoading = loadingPaths.has(entry.path);
            return (
              <li key={entry.path}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left transition hover:bg-slate-800/80 ${
                    activeFile === entry.path ? "bg-slate-800" : "bg-transparent"
                  }`}
                  onClick={() => (isDirectory ? onSelectDirectory(entry.path) : onSelectFile(entry.path))}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-slate-300">{entry.name}</span>
                    {dirty && <span className="text-xs text-amber-300">●</span>}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {isLoading ? "…" : isDirectory ? "dir" : `${entry.size ?? 0} B`}
                  </span>
                </button>
              </li>
            );
          })}
          {sessionId && token && currentEntries.length === 0 && (
            <li className="rounded bg-slate-900/60 px-3 py-4 text-xs text-slate-500">
              This directory is empty.
            </li>
          )}
          {(!sessionId || !token) && (
            <li className="rounded bg-slate-900/60 px-3 py-4 text-xs text-slate-500">
              {token ? "Start a session to view workspace files." : "Sign in to enable the workspace explorer."}
            </li>
          )}
        </ul>
      </div>
    );
  }
);

FileExplorer.displayName = "FileExplorer";

export default FileExplorer;
