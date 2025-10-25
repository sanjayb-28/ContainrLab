"use client";

import { useAuth } from "@/components/AuthProvider";
import { useLabSession } from "@/components/LabSessionProvider";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as Xterm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

const OPEN_DELAY_MS = 500;

type TerminalProps = {
  shell?: string;
  className?: string;
};

export default function Terminal({ shell = "/bin/sh", className = "" }: TerminalProps) {
  const { token } = useAuth();
  const { sessionId } = useLabSession();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Xterm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "ready" | "closed">("idle");

  useEffect(() => {
    if (!containerRef.current || !sessionId || !token) {
      return;
    }

    const term = new Xterm({
      theme: {
        background: "#0f172a",
      },
      convertEol: true,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: 14,
      allowTransparency: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    term.focus();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    const params = new URLSearchParams({ shell, token });
    const wsUrl = `${protocol}://${host}/ws/terminal/${sessionId}?${params.toString()}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    setStatus("connecting");

    const attachAddon = new AttachAddon(socket);
    term.loadAddon(attachAddon);

    socket.addEventListener("open", () => {
      setStatus("ready");
      setTimeout(() => {
        fitAddon.fit();
        socket.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }, OPEN_DELAY_MS);
    });

    socket.addEventListener("close", () => {
      setStatus("closed");
    });

    socket.addEventListener("error", () => {
      setStatus("closed");
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      socket.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      socket.close();
      term.dispose();
      termRef.current = null;
      wsRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, shell, token]);

  const statusMessage = !sessionId
    ? "Start a session to open a terminal."
    : !token
    ? "Sign in to connect to the terminal."
    : `Terminal status: ${status}`;

  return (
    <div className={className}>
      <div className="mb-2 text-xs text-slate-400">{statusMessage}</div>
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
      />
    </div>
  );
}
