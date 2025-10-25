"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SessionDetail } from "@/lib/labs";

export type LabSessionContextValue = {
  session: SessionDetail | null;
  sessionId: string | null;
  setSession: (session: SessionDetail | null) => void;
  setSessionId: (sessionId: string | null) => void;
};

const LabSessionContext = createContext<LabSessionContextValue | undefined>(undefined);

export function useLabSession(): LabSessionContextValue {
  const value = useContext(LabSessionContext);
  if (!value) {
    throw new Error("useLabSession must be used within a LabSessionProvider");
  }
  return value;
}

export function LabSessionProvider({
  children,
  initialSessionId,
}: {
  children: ReactNode;
  initialSessionId?: string | null;
}) {
  const [session, setSessionState] = useState<SessionDetail | null>(null);
  const [sessionId, setSessionIdState] = useState<string | null>(initialSessionId ?? null);

  const setSession = useCallback((next: SessionDetail | null) => {
    setSessionState(next);
    setSessionIdState(next?.session_id ?? null);
  }, []);

  const setSessionId = useCallback((nextId: string | null) => {
    setSessionIdState(nextId);
    setSessionState((current) => {
      if (current && current.session_id !== nextId) {
        return null;
      }
      return current;
    });
  }, []);

  const value = useMemo(
    () => ({
      session,
      sessionId,
      setSession,
      setSessionId,
    }),
    [session, sessionId, setSession, setSessionId]
  );

  return <LabSessionContext.Provider value={value}>{children}</LabSessionContext.Provider>;
}
