"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import WorkspacePane from "@/components/WorkspacePane";
import InspectorPanel from "@/components/InspectorPanel";
import AgentDrawer from "@/components/AgentDrawer";
import LabActions from "@/components/LabActions";
import Terminal from "@/components/Terminal";
import Markdown from "@/components/Markdown";
import CollapsiblePanel from "@/components/ui/CollapsiblePanel";
import { useLabSession } from "@/components/LabSessionProvider";

type LabPageClientProps = {
  slug: string;
  sessionId?: string | null;
  labDescription: string;
  labSolution?: string | null;
  labTitle: string;
  labSummary?: string | null;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
  },
};

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null) {
    return "—";
  }
  if (totalSeconds <= 0) {
    return "0s";
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (hours === 0 && seconds > 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

export default function LabPageClient({
  slug,
  sessionId,
  labDescription,
  labSolution,
  labTitle,
  labSummary,
}: LabPageClientProps) {
  const { session } = useLabSession();
  const [heroRemainingSeconds, setHeroRemainingSeconds] = useState<number | null>(null);

  const expiresAt = session?.expires_at ? new Date(session.expires_at).getTime() : null;
  const endedAt = session?.ended_at ? new Date(session.ended_at).getTime() : null;
  const sessionExpired = Boolean(endedAt) || (expiresAt !== null && Date.now() >= expiresAt);

  useEffect(() => {
    if (!expiresAt || sessionExpired) {
      setHeroRemainingSeconds(null);
      return;
    }
    const update = () => {
      const diff = Math.max(0, expiresAt - Date.now());
      setHeroRemainingSeconds(Math.floor(diff / 1000));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, sessionExpired]);

  const sessionStatus = useMemo(() => {
    if (!session) {
      return { label: "Session inactive", tone: "bg-slate-800 text-slate-200" };
    }
    if (sessionExpired) {
      return { label: "Session expired", tone: "bg-rose-500/20 text-rose-100" };
    }
    return { label: "Session running", tone: "bg-emerald-500/20 text-emerald-100" };
  }, [session, sessionExpired]);

  const heroStats = useMemo(
    () => [
      {
        label: "Attempts",
        value: session ? session.attempts.length : "0",
      },
      {
        label: "TTL remaining",
        value: session && !sessionExpired ? formatDuration(heroRemainingSeconds) : "—",
      },
      {
        label: "Runner",
        value: session?.runner_container ?? "—",
      },
    ],
    [heroRemainingSeconds, session, sessionExpired]
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      <motion.nav variants={itemVariants}>
        <motion.div
          whileHover={{ scale: 1.05, x: -4 }}
          whileTap={{ scale: 0.98 }}
          className="inline-block"
        >
          <Link
            href="/"
            className="btn-ripple card-shine inline-flex items-center gap-3 rounded-full border border-sky-400 bg-gradient-to-r from-sky-500/10 to-transparent px-5 py-2 text-sm font-semibold text-sky-100 shadow-lg shadow-sky-500/10 transition hover:border-sky-300 hover:from-sky-500/20 hover:text-white"
          >
            <span aria-hidden="true">&larr;</span>
            Back to all labs
          </Link>
        </motion.div>
      </motion.nav>

      <motion.section
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl"
      >
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -left-10 top-10 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        </div>
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
            <span className="text-sky-200">ContainrLab</span>
            <span className="text-slate-500">/</span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${sessionStatus.tone}`}>
              {sessionStatus.label}
            </span>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{labTitle}</h1>
            {labSummary ? <p className="max-w-3xl text-base text-slate-200/90">{labSummary}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {heroStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
                <p className="mt-2 text-xl font-semibold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.div variants={itemVariants}>
        <CollapsiblePanel title="Lab overview" defaultOpen>
          <Suspense
            fallback={
              <p className="animate-pulse text-sm text-slate-500">
                Loading description…
              </p>
            }
          >
            <Markdown content={labDescription} />
          </Suspense>
        </CollapsiblePanel>
      </motion.div>

      <motion.div variants={itemVariants}>
        <LabActions slug={slug} initialSessionId={sessionId} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <WorkspacePane />
      </motion.div>

      <motion.div variants={itemVariants}>
        <InspectorPanel />
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsiblePanel
          title="Terminal"
          subtitle="Connected session appears after you start one from the controls."
          className="bg-slate-950/70"
        >
          <Terminal className="mt-3" />
        </CollapsiblePanel>
      </motion.div>

      <motion.div variants={itemVariants}>
        <AgentDrawer labSlug={slug} />
      </motion.div>

      {labSolution ? (
        <motion.div variants={itemVariants}>
          <CollapsiblePanel title="Solution" defaultOpen={false}>
            <Suspense
              fallback={
                <p className="animate-pulse text-sm text-slate-500">
                  Loading solution…
                </p>
              }
            >
              <Markdown content={labSolution} />
            </Suspense>
          </CollapsiblePanel>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
