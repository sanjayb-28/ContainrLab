"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function AuthStatus() {
  const { token, user, login, logout, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }
    setSubmitting(true);
    try {
      await login(trimmed);
      setEmail("");
    } catch (err) {
      console.warn("Login failed", err);
    } finally {
      setSubmitting(false);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
      <span className="text-sm font-medium text-slate-100">Sign in to start labs</span>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
        disabled={loading || submitting}
        required
      />
      <button
        type="submit"
        className="rounded bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || submitting}
      >
        {submitting ? "Sending..." : "Send magic link"}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
      <span className="text-[11px] text-slate-500">
        We’ll return a one-time token in the response for development purposes.
      </span>
    </form>
  );
}
