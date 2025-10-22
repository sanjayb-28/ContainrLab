"use client";

import { useEffect, useState } from "react";
import { listPath, type ListResponse } from "@/lib/fs";

export type FileExplorerProps = {
  sessionId?: string;
  onSelect: (path: string, isDir: boolean) => void;
};

export default function FileExplorer({ sessionId, onSelect }: FileExplorerProps) {
  const [listing, setListing] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setListing(null);
      setError(null);
      return;
    }
    listPath(sessionId)
      .then((data) => {
        setListing(data);
        setError(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unable to list files";
        setError(message);
      });
  }, [sessionId]);

  if (!sessionId) {
    return <p className="text-sm text-slate-500">Start a session to explore files.</p>;
  }

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!listing) {
    return <p className="text-sm text-slate-400">Loading files...</p>;
  }

  return (
    <div className="space-y-2 text-sm text-slate-200">
      <div className="font-semibold text-slate-100">Workspace</div>
      <ul className="max-h-64 overflow-auto rounded border border-slate-800 bg-slate-950/80">
        {listing.entries.map((entry) => (
          <li
            key={entry.path}
            className="flex cursor-pointer items-center justify-between border-b border-slate-900 px-3 py-2 last:border-b-0 hover:bg-slate-800/60"
            onClick={() => onSelect(entry.path, entry.is_dir)}
          >
            <span>{entry.is_dir ? `📁 ${entry.name}` : `📄 ${entry.name}`}</span>
            {typeof entry.size === "number" && !entry.is_dir ? (
              <span className="text-xs text-slate-500">{entry.size} B</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
