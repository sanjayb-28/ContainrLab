"use client";

import { createEntry, deleteEntry, FsEntry, listPath, renameEntry } from "@/lib/fs";
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
import Modal from "@/components/ui/Modal";

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
    const [createError, setCreateError] = useState<string | null>(null);
    const [pendingCreate, setPendingCreate] = useState<{ kind: EntryKind; directory: string } | null>(null);
    const [newEntryName, setNewEntryName] = useState<string>("");

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
      (kind: EntryKind, directory: string) => {
        if (!sessionId || !token) {
          setError("Sign in and start a session before creating files.");
          return;
        }
        setCreateError(null);
        setError(null);
        setPendingCreate({ kind, directory });
        setNewEntryName(kind === "file" ? "app.py" : "new-folder");
      },
      [sessionId, token]
    );

    const closeCreateModal = useCallback(() => {
      setPendingCreate(null);
      setNewEntryName("");
      setCreateError(null);
    }, []);

    const submitCreate = useCallback(
      async () => {
        if (!pendingCreate || !sessionId || !token) {
          return;
        }
        const noun = pendingCreate.kind === "file" ? "file" : "folder";
        const trimmed = newEntryName.trim();
        if (!trimmed) {
          setCreateError(`A ${noun} name is required.`);
          return;
        }
        if (trimmed.includes("..")) {
          setCreateError("Parent directory references ('..') are not allowed.");
          return;
        }
        const normalizedName = trimmed.replace(/^[\\/]+/, "");
        const normalized = joinPath(pendingCreate.directory, normalizedName);
        try {
          if (pendingCreate.kind === "file") {
            await createEntry(sessionId, normalized, "file", "", token);
          } else {
            await createEntry(sessionId, normalized, "directory", undefined, token);
          }
          removeEntryTree(pendingCreate.directory);
          await fetchEntries(pendingCreate.directory);
          onEntryCreated(normalized, pendingCreate.kind);
          closeCreateModal();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create entry";
          setCreateError(message);
        }
      },
      [closeCreateModal, fetchEntries, newEntryName, onEntryCreated, pendingCreate, removeEntryTree, sessionId, token]
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
      <>
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
        <Modal
        open={Boolean(pendingCreate)}
        onClose={closeCreateModal}
        title={pendingCreate ? `Create a new ${pendingCreate.kind === "file" ? "file" : "folder"}` : undefined}
        size="sm"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeCreateModal}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitCreate()}
              className="inline-flex items-center justify-center rounded-full border border-sky-400 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 hover:text-white"
            >
              Create
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Name
            <input
              value={newEntryName}
              onChange={(event) => setNewEntryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitCreate();
                }
              }}
              autoFocus
              placeholder={pendingCreate?.kind === "file" ? "app.py" : "new-folder"}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </label>
          {createError ? <p className="text-xs text-rose-300">{createError}</p> : null}
        </div>
        </Modal>
      </>
    );
  }
);

FileExplorer.displayName = "FileExplorer";

export default FileExplorer;
