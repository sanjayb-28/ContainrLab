"use client";

import { useAuth } from "@/components/AuthProvider";
import FileExplorer, { FileExplorerHandle } from "@/components/FileExplorer";
import EditorPane from "@/components/EditorPane";
import { useLabSession } from "@/components/LabSessionProvider";
import { buildSession, fetchSession } from "@/lib/labs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const WORKSPACE_ROOT = "/workspace";
const AUTOSAVE_STORAGE_KEY = "containrlab.autosave";
const BUILD_ON_SAVE_STORAGE_KEY = "containrlab.buildOnSave";
const STATUS_TIMEOUT_MS = 4000;

type Breadcrumb = {
  label: string;
  path: string;
  isFile: boolean;
};

type SaveContext = {
  source: "manual" | "autosave";
};

function parentPath(path: string | undefined): string {
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

function isDescendant(base: string, candidate: string): boolean {
  if (base === candidate) {
    return true;
  }
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return candidate.startsWith(prefix);
}

function readBooleanSetting(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }
  const value = window.localStorage.getItem(key);
  if (value === null) {
    return fallback;
  }
  return value === "true";
}

function writeBooleanSetting(key: string, value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, value ? "true" : "false");
}

export default function WorkspacePane() {
  const { token } = useAuth();
  const { sessionId, setSession } = useLabSession();
  const explorerRef = useRef<FileExplorerHandle | null>(null);
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [activeFile, setActiveFile] = useState<string | undefined>();
  const [activeDirectory, setActiveDirectory] = useState<string>(WORKSPACE_ROOT);
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(() => readBooleanSetting(AUTOSAVE_STORAGE_KEY, true));
  const [buildOnSave, setBuildOnSave] = useState<boolean>(() => readBooleanSetting(BUILD_ON_SAVE_STORAGE_KEY, false));
  const [buildRunning, setBuildRunning] = useState(false);

  useEffect(() => {
    setActiveFile(undefined);
    setActiveDirectory(WORKSPACE_ROOT);
    setDirtyPaths(new Set());
    setStatusMessage(null);
  }, [sessionId]);

  useEffect(() => () => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
  }, []);

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage(null);
    }, STATUS_TIMEOUT_MS);
  }, []);

  const confirmNavigation = useCallback(
    (targetPath: string): boolean => {
      if (!activeFile) {
        return true;
      }
      if (targetPath === activeFile) {
        return true;
      }
      if (!dirtyPaths.has(activeFile)) {
        return true;
      }
      return window.confirm("You have unsaved changes. Continue without saving?");
    },
    [activeFile, dirtyPaths]
  );

  const handleSelectFile = useCallback(
    (path: string) => {
      if (!confirmNavigation(path)) {
        return;
      }
      setActiveFile(path);
      setActiveDirectory(parentPath(path));
    },
    [confirmNavigation]
  );

  const handleSelectDirectory = useCallback(
    (path: string) => {
      if (!confirmNavigation(path)) {
        return;
      }
      setActiveFile(undefined);
      setActiveDirectory(path);
    },
    [confirmNavigation]
  );

  const handleEntryCreated = useCallback(
    (path: string, kind: "file" | "directory") => {
      if (!confirmNavigation(path)) {
        return;
      }
      if (kind === "file") {
        setActiveFile(path);
        setActiveDirectory(parentPath(path));
      } else {
        setActiveFile(undefined);
        setActiveDirectory(path);
      }
      setDirtyPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    },
    [confirmNavigation]
  );

  const handleEntryRenamed = useCallback((oldPath: string, newPath: string) => {
    setDirtyPaths((prev) => {
      const next = new Set<string>();
      prev.forEach((dirty) => {
        if (dirty === oldPath) {
          return;
        }
        if (isDescendant(oldPath, dirty)) {
          return;
        }
        next.add(dirty);
      });
      return next;
    });

    setActiveFile((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev === oldPath) {
        return newPath;
      }
      if (isDescendant(oldPath, prev)) {
        return prev.replace(oldPath, newPath);
      }
      return prev;
    });

    setActiveDirectory((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev === oldPath) {
        return newPath;
      }
      if (isDescendant(oldPath, prev)) {
        return prev.replace(oldPath, newPath);
      }
      return prev;
    });
  }, []);

  const handleEntryDeleted = useCallback((path: string) => {
    setDirtyPaths((prev) => {
      const next = new Set<string>();
      prev.forEach((dirty) => {
        if (!isDescendant(path, dirty)) {
          next.add(dirty);
        }
      });
      return next;
    });

    setActiveFile((prev) => {
      if (prev && isDescendant(path, prev)) {
        return undefined;
      }
      return prev;
    });

    setActiveDirectory((prev) => {
      if (prev && isDescendant(path, prev)) {
        return parentPath(path);
      }
      return prev;
    });
  }, []);

  const handleDirtyChange = useCallback((path: string | undefined, dirty: boolean) => {
    if (!path) {
      return;
    }
    setDirtyPaths((prev) => {
      const next = new Set(prev);
      if (dirty) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  }, []);

  const handleSaved = useCallback(
    async (path: string, { source }: SaveContext) => {
      setDirtyPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      const directory = parentPath(path);
      void explorerRef.current?.refresh(directory);
      showStatus(source === "autosave" ? "Changes autosaved." : "File saved.");

      if (!buildOnSave || !sessionId || !token) {
        return;
      }

      setBuildRunning(true);
      showStatus("Running Docker build...");
      try {
        await buildSession(sessionId, token);
        showStatus("Build completed successfully.");
        const detail = await fetchSession(sessionId, token, 5);
        setSession(detail);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Build failed";
        showStatus(`Build failed: ${message}`);
      } finally {
        setBuildRunning(false);
      }
    },
    [buildOnSave, sessionId, setSession, showStatus, token]
  );

  const handleSaveError = useCallback(
    (_path: string | undefined, message: string) => {
      showStatus(`Save failed: ${message}`);
    },
    [showStatus]
  );

  const toggleAutosave = useCallback(() => {
    setAutosaveEnabled((prev) => {
      const next = !prev;
      writeBooleanSetting(AUTOSAVE_STORAGE_KEY, next);
      showStatus(`Autosave ${next ? "enabled" : "disabled"}.`);
      return next;
    });
  }, [showStatus]);

  const toggleBuildOnSave = useCallback(() => {
    setBuildOnSave((prev) => {
      const next = !prev;
      writeBooleanSetting(BUILD_ON_SAVE_STORAGE_KEY, next);
      showStatus(`Build on save ${next ? "enabled" : "disabled"}.`);
      return next;
    });
  }, [showStatus]);

  const currentTarget = activeFile ?? activeDirectory;
  const breadcrumbs = useMemo(() => {
    const parts: Breadcrumb[] = [{ label: "workspace", path: WORKSPACE_ROOT, isFile: false }];
    if (!currentTarget || currentTarget === WORKSPACE_ROOT) {
      return parts;
    }
    const relative = currentTarget
      .replace(WORKSPACE_ROOT, "")
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean);
    let accumulator = WORKSPACE_ROOT;
    relative.forEach((segment, index) => {
      accumulator = joinPath(accumulator, segment);
      const isLast = index === relative.length - 1;
      const isFile = Boolean(activeFile) && isLast;
      parts.push({ label: segment, path: accumulator, isFile });
    });
    return parts;
  }, [activeFile, currentTarget]);

  return (
    <div className="grid gap-6 md:grid-cols-[300px_1fr]">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <FileExplorer
          ref={explorerRef}
          activeFile={activeFile}
          activeDirectory={activeDirectory}
          dirtyPaths={dirtyPaths}
          onSelectFile={handleSelectFile}
          onSelectDirectory={handleSelectDirectory}
          onEntryCreated={handleEntryCreated}
          onEntryRenamed={handleEntryRenamed}
          onEntryDeleted={handleEntryDeleted}
        />
      </div>
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-400"
                checked={autosaveEnabled}
                onChange={toggleAutosave}
              />
              Autosave
            </label>
            <label className="inline-flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-400"
                checked={buildOnSave}
                onChange={toggleBuildOnSave}
                disabled={!token || !sessionId}
              />
              Build on save
            </label>
            {buildOnSave && (!token || !sessionId) && (
              <span className="text-[11px] text-amber-200">Sign in and start a session to run builds automatically.</span>
            )}
            {buildRunning && <span className="text-[11px] text-sky-300">Building…</span>}
          </div>
          {statusMessage && <span className="text-[11px] text-slate-400">{statusMessage}</span>}
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            if (isLast || crumb.isFile) {
              return (
                <span key={crumb.path} className="flex items-center gap-2">
                  <span className="font-medium text-slate-200">{crumb.label}</span>
                  {!isLast && <span>/</span>}
                </span>
              );
            }
            return (
              <span key={crumb.path} className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-sky-400 hover:text-sky-300"
                  onClick={() => handleSelectDirectory(crumb.path)}
                >
                  {crumb.label}
                </button>
                {!isLast && <span>/</span>}
              </span>
            );
          })}
        </nav>
        <EditorPane
          path={activeFile}
          autosaveEnabled={autosaveEnabled}
          onDirtyChange={handleDirtyChange}
          onSave={handleSaved}
          onSaveError={handleSaveError}
        />
      </div>
    </div>
  );
}
