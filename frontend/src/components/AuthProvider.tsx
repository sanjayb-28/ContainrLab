"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchCurrentUser, requestLogin, type AuthUser } from "@/lib/auth";

const STORAGE_KEY = "containrlab.auth";

type StoredAuth = {
  token: string;
  user: AuthUser;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}

function readStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token || !parsed?.user) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn("Failed to parse stored auth", error);
    return null;
  }
}

function writeStoredAuth(value: StoredAuth | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (!value) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setToken(stored.token);
      setUser(stored.user);
    }
    setLoading(false);
  }, []);

  const persist = useCallback((nextToken: string | null, nextUser: AuthUser | null) => {
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken && nextUser) {
      writeStoredAuth({ token: nextToken, user: nextUser });
    } else {
      writeStoredAuth(null);
    }
  }, []);

  const login = useCallback(
    async (email: string) => {
      setError(null);
      setLoading(true);
      try {
        const response = await requestLogin(email);
        persist(response.token, {
          user_id: response.user_id,
          email: response.email,
          created_at: response.created_at,
          last_login_at: response.last_login_at,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Login failed";
        setError(message);
        persist(null, null);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [persist]
  );

  const logout = useCallback(() => {
    persist(null, null);
    setError(null);
  }, [persist]);

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const profile = await fetchCurrentUser(token);
      persist(token, profile);
    } catch (err) {
      console.warn("Failed to refresh auth state", err);
      persist(null, null);
    }
  }, [persist, token]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, loading, error, login, logout, refresh }),
    [token, user, loading, error, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
