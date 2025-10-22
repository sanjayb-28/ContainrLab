"use client";

import {
  createEntry,
  deleteEntry,
  FsEntry,
  listPath,
  renameEntry,
} from "@/lib/fs";
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

export type FileExplorerHandle = {
  refresh: (path?: string) => Promise<void>;
};

export type FileExplorerProps = {
  sessionId?: string;
  activeFile?: string;
  activeDirectory: string;
  dirtyPaths: Set<string>;
  onSelectFile: (path: string) => void;
  onSelectDirectory: (path: string) => void;
  onEntryCreated: (path: string, kind: EntryKind) => void;
  onEntryRenamed: (oldPath: string, newPath: string) => void;
  onEntryDeleted: (path: string) => void;
};

type EntryMap = Record<string, FsEntry[]>;

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
    {
      sessionId,
      activeFile,
      activeDirectory,
      dirtyPaths,
      onSelectFile,
      onSelectDirectory,
      onEntryCreated,
      onEntryRenamed,
      onEntryDeleted,
    },
    ref
  ) => {
    const [entriesByPath, setEntriesByPath] = useState<EntryMap>({});
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([WORKSPACE_ROOT]));
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const sessionRef = useRef<string | undefined>();
    sessionRef.current = sessionId;

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
          return;
        }
        setLoading(path, true);
        try {
          const response = await listPath(sessionId, path === WORKSPACE_ROOT ? undefined : path);
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
      [sessionId, setLoading, updateEntryMap]
    );

    useEffect(() => {
      setEntriesByPath({});
      setExpandedPaths(new Set([WORKSPACE_ROOT]));
      setError(null);
      if (sessionId) {
        void fetchEntries(WORKSPACE_ROOT);
      }
    }, [fetchEntries, sessionId]);

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
      async (kind: EntryKind) => {
        if (!sessionId) {
          return;
        }
        const baseDirectory = activeDirectory || WORKSPACE_ROOT;
        const promptLabel = kind === "file" ? "Enter file name" : "Enter folder name";
        const name = window.prompt(promptLabel, "");
        if (!name) {
          return;
        }
        const sanitized = name.trim();
        if (!sanitized) {
          return;
        }
        const fullPath = joinPath(baseDirectory, sanitized);
        try {
          await createEntry(sessionId, fullPath, kind, "");
          await fetchEntries(baseDirectory);
          if (kind === "directory") {
            setExpandedPaths((prev) => new Set(prev).add(fullPath));
          }
          onEntryCreated(fullPath, kind);
        } catch (err) {
          const message = err instanceof Error ? err.message : `Failed to create ${kind}.`;
          setError(message);
        }
      },
      [activeDirectory, fetchEntries, onEntryCreated, sessionId]
    );

    const handleRename = useCallback(
      async (entry: FsEntry) => {
        if (!sessionId) {
          return;
        }
        const baseDirectory = parentPath(entry.path);
        const suggested = entry.name;
        const nextName = window.prompt(`Rename ${entry.is_dir ? "folder" : "file"}`, suggested);
        if (!nextName) {
          return;
        }
        const trimmed = nextName.trim();
        if (!trimmed || trimmed === suggested) {
          return;
        }
        const newPath = joinPath(baseDirectory, trimmed);
        try {
          await renameEntry(sessionId, entry.path, newPath);
          await fetchEntries(baseDirectory);
          if (entry.is_dir) {
            removeEntryTree(entry.path);
            setExpandedPaths((prev) => {
              const next = new Set(prev);
              if (next.has(entry.path)) {
                next.delete(entry.path);
                next.add(newPath);
              }
              return next;
            });
          }
          onEntryRenamed(entry.path, newPath);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to rename.";
          setError(message);
        }
      },
      [fetchEntries, onEntryRenamed, removeEntryTree, sessionId]
    );

    const handleDelete = useCallback(
      async (entry: FsEntry) => {
        if (!sessionId) {
          return;
        }
        const confirmed = window.confirm(`Delete ${entry.is_dir ? "folder" : "file"} '${entry.name}'?`);
        if (!confirmed) {
          return;
        }
        const baseDirectory = parentPath(entry.path);
        try {
          await deleteEntry(sessionId, entry.path);
          await fetchEntries(baseDirectory);
          removeEntryTree(entry.path);
          onEntryDeleted(entry.path);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete.";
          setError(message);
        }
      },
      [fetchEntries, onEntryDeleted, removeEntryTree, sessionId]
    );

    const directoryEntries = useMemo(() => entriesByPath[WORKSPACE_ROOT] ?? [], [entriesByPath]);
    const isLoadingRoot = loadingPaths.has(WORKSPACE_ROOT);

    const renderEntries = useCallback(
      (path: string, depth: number): JSX.Element | null => {
        const entries = entriesByPath[path];
        if (!entries || entries.length === 0) {
          return null;
        }
        const sorted = [...entries].sort((a, b) => {
          if (a.is_dir === b.is_dir) {
            return a.name.localeCompare(b.name);
          }
          return a.is_dir ? -1 : 1;
        });

        return (
          <ul>
            {sorted.map((entry) => {
              const isExpanded = expandedPaths.has(entry.path);
              const isLoading = loadingPaths.has(entry.path);
              const isActiveFile = entry.path === activeFile;
              const isActiveDirectory = entry.path === activeDirectory;
              const showDirtyIndicator = formatDirtyIndicator(dirtyPaths, entry.path, entry.is_dir);
              return (
                <li key={entry.path}>
                  <div
                    className={`flex items-center gap-2 px-2 py-1 text-sm ${
                      isActiveFile || isActiveDirectory
                        ? "bg-slate-800/70 text-slate-100"
                        : "hover:bg-slate-800/40"
                    }`}
                    style={{ paddingLeft: depth * 12 }}
                  >
                    {entry.is_dir ? (
                      <button
                        type="button"
                        onClick={() => toggleDirectory(entry.path)}
                        className="text-slate-400 transition hover:text-slate-200"
                        aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="w-3" />
                    )}
                    <button
                      type="button"
                      className={`flex-1 text-left ${entry.is_dir ? "font-medium" : ""}`}
                      onClick={() =>
                        entry.is_dir ? onSelectDirectory(entry.path) : onSelectFile(entry.path)
                      }
                    >
                      {entry.is_dir ? "📁" : "📄"} {entry.name}
                      {showDirtyIndicator && <span className="ml-1 text-xs text-amber-300">●</span>}
                    </button>
                    {isLoading && <span className="text-xs text-slate-400">…</span>}
                    <div className="flex gap-1 text-xs">
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                        onClick={() => handleRename(entry)}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDelete(entry)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {entry.is_dir && isExpanded && renderEntries(entry.path, depth + 1)}
                </li>
              );
            })}
          </ul>
        );
      },
      [
        activeDirectory,
        activeFile,
        dirtyPaths,
        entriesByPath,
        expandedPaths,
        handleDelete,
        handleRename,
        loadingPaths,
        onSelectDirectory,
        onSelectFile,
        toggleDirectory,
      ]
    );

    if (!sessionId) {
      return <p className="text-sm text-slate-500">Start a session to explore files.</p>;
    }

    return (
      <div className="space-y-3 text-sm text-slate-200">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-100">Workspace</div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
              onClick={() => handleCreate("file")}
            >
              New File
            </button>
            <button
              type="button"
              className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
              onClick={() => handleCreate("directory")}
            >
              New Folder
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="max-h-72 overflow-auto rounded border border-slate-800 bg-slate-950/80">
          {isLoadingRoot && !directoryEntries.length ? (
            <p className="px-3 py-2 text-xs text-slate-400">Loading files...</p>
          ) : directoryEntries.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">This workspace is empty.</p>
          ) : (
            renderEntries(WORKSPACE_ROOT, 0)
          )}
        </div>
      </div>
    );
  }
);

FileExplorer.displayName = "FileExplorer";

export default FileExplorer;
