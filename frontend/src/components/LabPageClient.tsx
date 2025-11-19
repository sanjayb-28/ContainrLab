"use client";

import Link from "next/link";
import { Suspense } from "react";
import { motion } from "framer-motion";
import WorkspacePane from "@/components/WorkspacePane";
import InspectorPanel from "@/components/InspectorPanel";
import AgentDrawer from "@/components/AgentDrawer";
import LabActions from "@/components/LabActions";
import Terminal from "@/components/Terminal";
import Markdown from "@/components/Markdown";
import CollapsiblePanel from "@/components/ui/CollapsiblePanel";

type LabPageClientProps = {
  slug: string;
  sessionId?: string | null;
  labDescription: string;
  labSolution?: string | null;
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

export default function LabPageClient({
  slug,
  sessionId,
  labDescription,
  labSolution,
}: LabPageClientProps) {
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

      <AgentDrawer labSlug={slug} />

      <motion.div variants={itemVariants}>
        <CollapsiblePanel
          title="Terminal"
          subtitle="Connected session appears after you start one from the controls."
        >
          <Terminal className="mt-3" />
        </CollapsiblePanel>
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
