"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import type { AuthUser } from "@/lib/auth";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
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

export default function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextBridge>{children}</AuthContextBridge>
    </SessionProvider>
  );
}

function AuthContextBridge({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();
  const [error, setError] = useState<string | null>(null);
  const loading = status === "loading";

  const user = useMemo<AuthUser | null>(() => {
    if (!session?.backendUserId || !session?.user?.email) {
      return null;
    }
    return {
      user_id: session.backendUserId,
      email: session.user.email,
      created_at: session.backendCreatedAt ?? "",
      last_login_at: session.backendLastLoginAt ?? "",
      name: session.user.name ?? undefined,
      avatar_url: session.user.image ?? undefined,
    };
  }, [
    session?.backendCreatedAt,
    session?.backendLastLoginAt,
    session?.backendUserId,
    session?.user?.email,
    session?.user?.image,
    session?.user?.name,
  ]);

  const login = useCallback(async () => {
    setError(null);
    const result = await signIn("github", { redirect: false });
    if (result?.error) {
      setError(result.error);
      throw new Error(result.error);
    }
  }, []);

  const logout = useCallback(() => {
    setError(null);
    void signOut({ callbackUrl: "/" });
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    await update();
  }, [update]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: session?.backendToken ?? null,
      user,
      loading,
      error,
      login,
      logout,
      refresh,
    }),
    [session?.backendToken, user, loading, error, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
