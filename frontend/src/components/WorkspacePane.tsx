"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FileExplorer, { FileExplorerHandle } from "@/components/FileExplorer";
import EditorPane from "@/components/EditorPane";
import { useLabSession } from "@/components/LabSessionProvider";

const WORKSPACE_ROOT = "/workspace";

type Breadcrumb = {
  label: string;
  path: string;
  isFile: boolean;
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

export default function WorkspacePane() {
  const { sessionId } = useLabSession();
  const explorerRef = useRef<FileExplorerHandle | null>(null);
  const [activeFile, setActiveFile] = useState<string | undefined>();
  const [activeDirectory, setActiveDirectory] = useState<string>(WORKSPACE_ROOT);
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    setActiveFile(undefined);
    setActiveDirectory(WORKSPACE_ROOT);
    setDirtyPaths(new Set());
  }, [sessionId]);

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

  const handleSave = useCallback((path: string) => {
    setDirtyPaths((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
    const directory = parentPath(path);
    void explorerRef.current?.refresh(directory);
  }, []);

  const currentTarget = activeFile ?? activeDirectory;
  const breadcrumbs = useMemo(() => {
    const parts: Breadcrumb[] = [{ label: "workspace", path: WORKSPACE_ROOT, isFile: false }];
    if (!currentTarget || currentTarget === WORKSPACE_ROOT) {
      return parts;
    }
    const relative = currentTarget
      .replace(WORKSPACE_ROOT, "")
      .replace(/^\/+/u, "")
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
        <EditorPane path={activeFile} onDirtyChange={handleDirtyChange} onSave={handleSave} />
      </div>
    </div>
  );
}
