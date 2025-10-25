"use client";

import { useAuth } from "@/components/AuthProvider";
import { useLabSession } from "@/components/LabSessionProvider";
import { decodeFromBase64, encodeToBase64, readFile, writeFile } from "@/lib/fs";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const AUTOSAVE_DELAY_MS = 1500;

type SaveSource = "manual" | "autosave";

export type EditorPaneProps = {
  path?: string;
  autosaveEnabled: boolean;
  onDirtyChange?: (path: string | undefined, dirty: boolean) => void;
  onSave?: (path: string, context: { source: SaveSource }) => void;
  onSaveError?: (path: string | undefined, message: string) => void;
};

export default function EditorPane({ path, autosaveEnabled, onDirtyChange, onSave, onSaveError }: EditorPaneProps) {
  const { token } = useAuth();
  const { sessionId } = useLabSession();
  const [content, setContent] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "dirty" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const previousPathRef = useRef<string | undefined>();
  const dirtyStateRef = useRef<{ path?: string; dirty: boolean }>({ path: undefined, dirty: false });
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!sessionId || !token || !path) {
      setContent("");
      setStatus("idle");
      setError(sessionId && !token ? "Sign in to edit files." : null);
      updateDirtyState(undefined, false);
      return;
    }
    setStatus("loading");
    readFile(sessionId, path, token)
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
  }, [path, sessionId, token, updateDirtyState]);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const handleSave = useCallback(
    async (source: SaveSource = "manual") => {
      if (!sessionId || !token || !path) {
        return;
      }
      setStatus("saving");
      try {
        await writeFile(sessionId, path, encodeToBase64(content), token);
        updateDirtyState(path, false);
        onSave?.(path, { source });
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save file";
        setError(message);
        setStatus("error");
        onSaveError?.(path, message);
      }
    },
    [content, onSave, onSaveError, path, sessionId, token, updateDirtyState]
  );

  useEffect(() => {
    return () => {
      clearAutosaveTimer();
    };
  }, [clearAutosaveTimer]);

  useEffect(() => {
    if (!autosaveEnabled || status !== "dirty") {
      clearAutosaveTimer();
      return;
    }
    clearAutosaveTimer();
    autosaveTimerRef.current = setTimeout(() => {
      void handleSave("autosave");
    }, AUTOSAVE_DELAY_MS);
  }, [autosaveEnabled, clearAutosaveTimer, handleSave, status]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (status !== "saving") {
          void handleSave("manual");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, status]);

  const disabled = !sessionId || !token;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Editor</h2>
          <p className="text-xs text-slate-500">
            {path ? path : disabled ? "Start a session to load files." : "Select a file to begin."}
          </p>
        </div>
        {path && (
          <button
            type="button"
            onClick={() => handleSave("manual")}
            disabled={status === "saving" || disabled}
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
            options={{ minimap: { enabled: false }, readOnly: disabled }}
            onChange={(value) => {
              if (disabled) {
                return;
              }
              setContent(value ?? "");
              setStatus("dirty");
              updateDirtyState(path, true);
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {disabled ? "Sign in and start a session to edit files." : "Select a file to start editing."}
          </div>
        )}
      </div>
      {status === "dirty" && <p className="text-xs text-slate-400">Unsaved changes</p>}
      {status === "saved" && <p className="text-xs text-emerald-300">Saved ✓</p>}
    </div>
  );
}
