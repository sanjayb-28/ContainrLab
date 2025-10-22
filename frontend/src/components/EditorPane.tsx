"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { decodeFromBase64, encodeToBase64, readFile, writeFile } from "@/lib/fs";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export type EditorPaneProps = {
  sessionId?: string;
  path?: string;
  onDirtyChange?: (path: string | undefined, dirty: boolean) => void;
  onSave?: (path: string) => void;
};

export default function EditorPane({ sessionId, path, onDirtyChange, onSave }: EditorPaneProps) {
  const [content, setContent] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "dirty" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const previousPathRef = useRef<string | undefined>();
  const dirtyStateRef = useRef<{ path?: string; dirty: boolean }>({ path: undefined, dirty: false });

  const updateDirtyState = useCallback(
    (targetPath: string | undefined, dirty: boolean) => {
      const previous = dirtyStateRef.current;
      if (previous.path === targetPath && previous.dirty === dirty) {
        return;
      }
      dirtyStateRef.current = { path: targetPath, dirty };
      if (targetPath) {
        onDirtyChange?.(targetPath, dirty);
      }
    },
    [onDirtyChange]
  );

  useEffect(() => {
    if (previousPathRef.current && previousPathRef.current !== path) {
      updateDirtyState(previousPathRef.current, false);
    }
    previousPathRef.current = path;
  }, [path, updateDirtyState]);

  useEffect(() => {
    if (!sessionId || !path) {
      setContent("");
      setStatus("idle");
      setError(null);
      updateDirtyState(undefined, false);
      return;
    }
    setStatus("loading");
    readFile(sessionId, path)
      .then((resp) => {
        setContent(decodeFromBase64(resp.content));
        setStatus("idle");
        setError(null);
        updateDirtyState(path, false);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load file";
        setError(message);
        setStatus("error");
      });
  }, [path, sessionId, updateDirtyState]);

  const handleSave = async () => {
    if (!sessionId || !path) {
      return;
    }
    setStatus("saving");
    try {
      await writeFile(sessionId, path, encodeToBase64(content));
      updateDirtyState(path, false);
      onSave?.(path);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save file";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Editor</h2>
          <p className="text-xs text-slate-500">{path ? path : "Select a file to begin."}</p>
        </div>
        {path && (
          <button
            type="button"
            onClick={handleSave}
            disabled={status === "saving"}
            className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "saving" ? "Saving..." : "Save"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="h-96 w-full overflow-hidden rounded border border-slate-800 bg-slate-950">
        {path ? (
          <MonacoEditor
            language="dockerfile"
            theme="vs-dark"
            value={content}
            options={{ minimap: { enabled: false } }}
            onChange={(value) => {
              setContent(value ?? "");
              setStatus("dirty");
              updateDirtyState(path, true);
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Select a file to start editing.
          </div>
        )}
      </div>
      {status === "dirty" && <p className="text-xs text-slate-400">Unsaved changes</p>}
      {status === "saved" && <p className="text-xs text-emerald-300">Saved ✓</p>}
    </div>
  );
}
