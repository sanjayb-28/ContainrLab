"use client";

import Link from "next/link";
import FeatureCarousel from "@/components/FeatureCarousel";
import { useAuth } from "@/components/AuthProvider";

const stats = [
  { label: "Labs ready", value: "12+" },
  { label: "Container builds run", value: "9k" },
  { label: "Learners leveling up", value: "4.7k" },
];

export default function LandingContent() {
  const { login, token } = useAuth();

  return (
    <div className="space-y-24">
      <section className="grid gap-12 rounded-3xl border border-white/10 bg-slate-950/60 p-10 shadow-xl ring-1 ring-white/10 backdrop-blur-xl md:grid-cols-2 md:p-14">
        <div className="space-y-6">
          <span className="inline-flex w-fit rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100">
            Container mastery
          </span>
          <h1 className="text-4xl font-bold text-white md:text-5xl">
            Build real containers, guided by an AI coach and instant feedback.
          </h1>
          <p className="text-base text-slate-300 md:text-lg">
            ContainrLab gives you a full Docker workspace in the browser. Learn by doing,
            with automated judges, rich metrics, and a helpful AI agent when you get stuck.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => login()}
              className="inline-flex w-full items-center justify-center rounded-full border border-sky-400 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 hover:text-white sm:w-auto"
            >
              {token ? "Continue learning" : "Start free with GitHub"}
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Explore the dashboard
            </Link>
          </div>
          <dl className="mt-8 grid gap-6 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center shadow-inner">
                <dt className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="relative h-full w-full rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-inner backdrop-blur-2xl">
            <div className="h-full w-full rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
              <div className="space-y-5 text-sm font-mono text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-slate-100">Live Docker workspace</h3>
                  <p className="mt-2 text-xs text-slate-400">
                    Edit files, run commands, and apply AI patches directly in the browser.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-slate-100">Judge insights</h3>
                  <p className="mt-2 text-xs text-slate-400">
                    Validate your work with pass/fail results, diffable metrics, and attempt timelines.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-slate-100">Session persistence</h3>
                  <p className="mt-2 text-xs text-slate-400">
                    Reopen the browser or sign back in and continue in the same workspace instantly.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-slate-100">Terminal resilience</h3>
                  <p className="mt-2 text-xs text-slate-400">
                    Automatic reconnect keeps your terminal alive even when restoring or creating fresh sessions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FeatureCarousel />

      <section className="grid gap-8 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white">Workspace-first learning</h3>
          <p className="mt-3 text-sm text-slate-300">
            Every lab gives you a repo, Docker daemon access, and a terminal. You learn by shipping real containers.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white">Guidance without spoilers</h3>
          <p className="mt-3 text-sm text-slate-300">
            AI hints nudge you forward, explanations reinforce concepts, and patches unlock when you need them.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white">Inspector & history</h3>
          <p className="mt-3 text-sm text-slate-300">
            Review judge deltas, compare attempts, and drill into metrics without leaving the browser.
          </p>
        </div>
      </section>
    </div>
  );
}
