"use client";

import { useAuth } from "@/components/AuthProvider";
import { useLabSession } from "@/components/LabSessionProvider";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as Xterm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { DISPLAY_API_BASE } from "@/lib/api";

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
  const [status, setStatus] = useState<"idle" | "connecting" | "ready" | "closed" | "error">("idle");
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualCloseRef = useRef(false);
  const [reconnectTick, setReconnectTick] = useState(0);
  const attemptsRef = useRef(0);
  const [lastDisconnect, setLastDisconnect] = useState<{ code: number; reason: string } | null>(null);

  useEffect(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    if (!containerRef.current || !sessionId || !token) {
      setStatus(sessionId && token ? "closed" : "idle");
      attemptsRef.current = 0;
      setLastDisconnect(null);
      return;
    }

    attemptsRef.current = 0;
    setLastDisconnect(null);

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

    const params = new URLSearchParams({ shell, token });
    let wsUrl: string;
    try {
      const apiUrl = new URL(DISPLAY_API_BASE);
      const wsProtocol = apiUrl.protocol === "https:" ? "wss" : "ws";
      const basePath = apiUrl.pathname.replace(/\/$/, "");
      wsUrl = `${wsProtocol}://${apiUrl.host}${basePath}/ws/terminal/${sessionId}?${params.toString()}`;
    } catch {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const host = window.location.host;
      wsUrl = `${protocol}://${host}/ws/terminal/${sessionId}?${params.toString()}`;
    }
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    manualCloseRef.current = false;

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

    const scheduleReconnect = (event?: CloseEvent | Event) => {
      if (manualCloseRef.current || !sessionId || !token) {
        return;
      }
      const closeEvent = event instanceof CloseEvent ? event : undefined;
      if (closeEvent) {
        setLastDisconnect({ code: closeEvent.code, reason: closeEvent.reason });
      }
      attemptsRef.current += 1;
      if (attemptsRef.current > 5) {
        setStatus("error");
        return;
      }
      const delay = Math.min(5000, 750 * 2 ** Math.max(0, attemptsRef.current - 1));
      reconnectRef.current = setTimeout(() => {
        setReconnectTick((tick) => tick + 1);
      }, delay);
    };

    socket.addEventListener("close", (event) => {
      setStatus(manualCloseRef.current ? "closed" : "closed");
      scheduleReconnect(event);
    });

    socket.addEventListener("error", (event) => {
      setStatus("closed");
      scheduleReconnect(event);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      socket.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      manualCloseRef.current = true;
      resizeObserver.disconnect();
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      socket.close();
      term.dispose();
      termRef.current = null;
      wsRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, shell, token, reconnectTick]);

  const statusMessage = !sessionId
    ? "Start a session to open a terminal."
    : !token
    ? "Sign in to connect to the terminal."
    : status === "error"
    ? "Terminal connection failed repeatedly. Please wait a moment, then click Start Session again if needed."
    : lastDisconnect
    ? `Terminal status: ${status}. Last disconnect (code ${lastDisconnect.code}): ${lastDisconnect.reason || "no reason supplied"}.`
    : `Terminal status: ${status}`;

  return (
    <div className={className}>
      <div className="mb-2 font-mono text-xs text-slate-400">{statusMessage}</div>
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
      />
    </div>
  );
}
