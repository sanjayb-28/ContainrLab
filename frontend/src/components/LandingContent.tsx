"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import FeatureCarousel from "@/components/FeatureCarousel";
import { useAuth } from "@/components/AuthProvider";
import AnimatedCounter from "@/components/ui/AnimatedCounter";

const stats = [
  { label: "Labs ready", value: 12, suffix: "+" },
  { label: "Container builds run", value: 9000, suffix: "+" },
  { label: "Learners leveling up", value: 4700, suffix: "+" },
];

export default function LandingContent() {
  const { login, token } = useAuth();
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const isHeroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const isFeaturesInView = useInView(featuresRef, { once: true, margin: "-100px" });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="space-y-24"
    >
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="group relative grid gap-12 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 p-10 shadow-xl ring-1 ring-white/10 backdrop-blur-xl transition-all hover:border-sky-400/30 hover:shadow-2xl hover:shadow-sky-500/10 md:grid-cols-2 md:p-14"
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        </div>
        <div className="relative z-10 space-y-6">
          <span className="inline-flex w-fit rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100">
            Container mastery
          </span>
          <h1 className="text-4xl font-bold md:text-5xl">
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-white via-sky-100 to-white bg-clip-text text-transparent animate-gradient">
                Build real containers, guided by an AI coach and instant feedback.
              </span>
              <motion.span
                className="absolute -inset-1 bg-gradient-to-r from-sky-400/20 via-violet-400/20 to-emerald-400/20 blur-2xl"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                aria-hidden
              />
            </span>
          </h1>
          <p className="text-base text-slate-300 md:text-lg">
            ContainrLab gives you a full Docker workspace in the browser. Learn by doing,
            with automated judges, rich metrics, and a helpful AI agent when you get stuck.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <motion.button
              type="button"
              onClick={() => login()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex w-full items-center justify-center rounded-full border border-sky-400 bg-gradient-to-r from-sky-500/10 to-sky-600/10 px-6 py-3 text-sm font-semibold text-sky-100 shadow-lg shadow-sky-500/20 transition hover:border-sky-300 hover:from-sky-500/20 hover:to-sky-600/20 hover:text-white sm:w-auto"
            >
              {token ? "Continue learning" : "Start free with GitHub"}
            </motion.button>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
              >
                Explore the dashboard
              </Link>
            </motion.div>
          </div>
          <dl className="mt-8 grid gap-6 sm:grid-cols-3">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -4, rotateY: 5 }}
                style={{ transformStyle: "preserve-3d" }}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 text-center shadow-inner transition-all hover:border-sky-400/40 hover:from-white/10 hover:to-white/5 hover:shadow-lg hover:shadow-sky-500/10"
              >
                <dt className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold text-white">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>
        <div className="relative z-10 flex items-center justify-center">
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
      </motion.section>

      <div ref={featuresRef}>
        <FeatureCarousel />
      </div>

      <motion.section
        ref={heroRef}
        initial={{ opacity: 0, y: 20 }}
        animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="grid gap-8 md:grid-cols-3"
      >
        {[
          {
            title: "Workspace-first learning",
            description: "Every lab gives you a repo, Docker daemon access, and a terminal. You learn by shipping real containers.",
          },
          {
            title: "Guidance without spoilers",
            description: "AI hints nudge you forward, explanations reinforce concepts, and patches unlock when you need them.",
          },
          {
            title: "Inspector & history",
            description: "Review judge deltas, compare attempts, and drill into metrics without leaving the browser.",
          },
        ].map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
            whileHover={{ scale: 1.03, y: -8, rotateX: 2 }}
            style={{ transformStyle: "preserve-3d", perspective: 1000 }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-lg backdrop-blur-xl transition-all hover:border-emerald-400/30 hover:shadow-xl hover:shadow-emerald-500/10"
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" />
            </div>
            <h3 className="relative z-10 text-lg font-semibold text-white">{item.title}</h3>
            <p className="relative z-10 mt-3 text-sm text-slate-300">
              {item.description}
            </p>
          </motion.div>
        ))}
      </motion.section>
    </motion.div>
  );
}
