"use client";

import { useState } from "react";
import FileExplorer from "@/components/FileExplorer";
import EditorPane from "@/components/EditorPane";

type Props = {
  sessionId?: string;
};

export default function WorkspacePane({ sessionId }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | undefined>();

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <FileExplorer
          sessionId={sessionId}
          onSelect={(path, isDir) => {
            if (!isDir) {
              setSelectedPath(path);
            }
          }}
        />
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <EditorPane sessionId={sessionId} path={selectedPath} />
      </div>
    </div>
  );
}
