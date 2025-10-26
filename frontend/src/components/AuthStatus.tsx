"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function AuthStatus() {
  const { token, user, login, logout, loading, error } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await login();
    } catch (err) {
      console.warn("GitHub sign-in failed", err);
    } finally {
      setSigningIn(false);
    }
  };

  if (token && user) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-100">Signed in</span>
          <button
            type="button"
            onClick={logout}
            className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
        <span>{user.email}</span>
        <span className="text-[11px] text-slate-500">User ID: {user.user_id}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
      <span className="text-sm font-medium text-slate-100">Sign in to start labs</span>
      <button
        type="button"
        onClick={handleLogin}
        className="rounded bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || signingIn}
      >
        {loading || signingIn ? "Connecting..." : "Continue with GitHub"}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
      <span className="text-[11px] text-slate-500">
        We’ll redirect you to GitHub for authentication and bring you right back.
      </span>
    </div>
  );
}
