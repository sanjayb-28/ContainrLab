"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { LabSummary } from "@/lib/labs";
import Modal from "@/components/ui/Modal";

type DashboardViewProps = {
  labs: LabSummary[];
};

type LearnTopic = {
  id: string;
  title: string;
  level: string;
  summary: string;
  content: string[];
  image: string;
  tintClass: string;
};

const learnTopics: LearnTopic[] = [
  {
    id: "what-is-docker",
    title: "What is Docker?",
    level: "Primer",
    summary: "Why containers exist, how they differ from VMs, and where Docker fits in.",
    content: [
      "Docker packages an app plus its dependencies into a portable image that runs the same anywhere.",
      "Images are immutable templates; containers are running instances created from those images.",
      "Docker CLI talks to the Docker daemon—either locally (our labs) or on a remote host.",
    ],
    image: "https://illustrations.popsy.co/blue/server.svg",
    tintClass: "bg-sky-500/25",
  },
  {
    id: "what-is-a-container",
    title: "What is a container?",
    level: "Primer",
    summary: "Learn how namespaces, cgroups, and layers create isolated runtime environments.",
    content: [
      "Containers share the host kernel but isolate processes with namespaces (PID, NET, MNT, etc.).",
      "Control groups (cgroups) enforce CPU, memory, and process limits for each container.",
      "Writable container layers sit on top of read-only image layers—destroy the container and that layer disappears.",
    ],
    image: "https://illustrations.popsy.co/green/container.svg",
    tintClass: "bg-emerald-500/25",
  },
  {
    id: "docker-basics",
    title: "Dockerfile fundamentals",
    level: "Beginner",
    summary: "Understand the anatomy of a Dockerfile and how build layers work.",
    content: [
      "FROM sets the base image—prefer slim distributions to reduce final size.",
      "RUN executes commands during build; combine apt-get installs to keep layer count low.",
      "COPY vs ADD: use COPY for predictable behaviour, ADD only when you need remote URLs or tar extraction.",
      "Set a HEALTHCHECK to give orchestration tools a reliable readiness signal.",
    ],
    image: "https://illustrations.popsy.co/blue/code.svg",
    tintClass: "bg-sky-400/25",
  },
  {
    id: "images-vs-containers",
    title: "Images vs. containers",
    level: "Core concept",
    summary: "Clarify the lifecycle from immutable image to running container instance.",
    content: [
      "Images are templates; containers are live processes created from those templates.",
      "Use tags (ex: containrlab/web:1.0.0) to version your images for CI/CD.",
      "Stopped containers keep their writable layer until you remove them—remember to clean up!",
    ],
    image: "https://illustrations.popsy.co/violet/version-control.svg",
    tintClass: "bg-violet-500/25",
  },
  {
    id: "compose",
    title: "Compose like a pro",
    level: "Intermediate",
    summary: "Orchestrate multi-service dev environments with Docker Compose.",
    content: [
      "Use profiles to toggle optional services (e.g. observability stack) during development.",
      "Keep secrets out of compose files—reference environment variables or mounted secrets instead.",
      "Combine `depends_on` with healthchecks to ensure services start in the correct order.",
    ],
    image: "https://illustrations.popsy.co/green/teamwork.svg",
    tintClass: "bg-emerald-500/20",
  },
  {
    id: "optimise",
    title: "Optimise your builds",
    level: "Advanced",
    summary: "Trim image size, speed up builds, and cache strategically.",
    content: [
      "Adopt multi-stage builds so final images contain only runtime dependencies.",
      "Leverage BuildKit secrets to avoid leaking credentials while installing private dependencies.",
      "Inspect build cache hits via `docker buildx build --progress=plain` to diagnose slow layers.",
    ],
    image: "https://illustrations.popsy.co/amber/rocket.svg",
    tintClass: "bg-amber-400/25",
  },
  {
    id: "docker-run",
    title: "docker run essentials",
    level: "Hands-on",
    summary: "Master the flags that control networking, volumes, and environment when running containers.",
    content: [
      "`docker run -it --rm` removes containers automatically—perfect for iterative lab work.",
      "Bind mount source code with `-v $(pwd):/workspace` to test changes without rebuilding.",
      "Map ports explicitly with `-p host:container` so health checks hit the right endpoint.",
    ],
    image: "https://illustrations.popsy.co/blue/terminal.svg",
    tintClass: "bg-indigo-500/25",
  },
  {
    id: "registry-workflow",
    title: "Registry workflow",
    level: "Hands-on",
    summary: "Tag, push, and pull images so your containers travel from dev to production safely.",
    content: [
      "Tag images with meaningful versions: `docker tag containrlab/web containrlab/web:1.2.0`.",
      "Use `docker login` before pushing to authenticated registries.",
      "Prune unused tags (`docker image prune`) to keep local disk usage in check.",
    ],
    image: "https://illustrations.popsy.co/red/cloud-upload.svg",
    tintClass: "bg-rose-500/30",
  },
];

export default function DashboardView({ labs }: DashboardViewProps) {
  const [selectedTopic, setSelectedTopic] = useState<LearnTopic | null>(null);

  const orderedLabs = useMemo(
    () =>
      [...labs].sort((a, b) => (a.title || a.slug).localeCompare(b.title || b.slug, undefined, { sensitivity: "base" })),
    [labs]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="space-y-16"
    >
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-8 shadow-lg transition-all hover:border-emerald-400/30 hover:shadow-xl hover:shadow-emerald-500/10 md:p-12"
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mt-2 inline-flex">
              <h1 className="whitespace-nowrap text-3xl font-bold text-white md:text-4xl">
                Your <span className="text-[#0DB7ED]">Docker</span> learning hub
              </h1>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
              Continue a lab where you left off, or explore new lessons to deepen your container tooling knowledge.
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} className="inline-block">
            <Link
              href="/labs/lab1"
              className="inline-flex items-center justify-center rounded-full border border-emerald-400 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 px-6 py-3 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/20 transition hover:border-emerald-300 hover:from-emerald-500/20 hover:to-emerald-600/20 hover:text-white"
            >
              Resume lab
            </Link>
          </motion.div>
        </div>
      </motion.section>

      <section id="labs" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Labs</h2>
            <p className="mt-1 text-sm text-slate-400">Launch a workspace and start building immediately.</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/40"
          >
            View home
          </Link>
        </div>
        {orderedLabs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/20 bg-slate-950/50 p-8 text-sm text-slate-400">
            No labs are published yet. Add content under <code>labs/</code> to populate the dashboard.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {orderedLabs.map((lab, index) => (
              <motion.article
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -8, rotateY: 3 }}
                style={{ transformStyle: "preserve-3d", perspective: 1000 }}
                key={lab.slug}
                className="card-shine group relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/60 to-slate-900/40 p-7 shadow-lg backdrop-blur-xl transition hover:border-sky-400/40 hover:shadow-xl hover:shadow-sky-500/20"
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-sky-500/20 blur-3xl" />
                  <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />
                </div>
                <div className="relative z-10 flex flex-1 flex-col gap-4">
                  <span className="w-fit rounded-full border border-sky-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100">
                    {lab.has_starter ? "Workspace ready" : "Hands-on practice"}
                  </span>
                  <h3 className="text-xl font-semibold text-white">{lab.title || lab.slug}</h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {(() => {
                      if (lab.slug === "lab2") {
                        return "Optimise a FastAPI Dockerfile so dependency layers stay cached, rebuilds finish in seconds, and the health endpoint keeps responding.";
                      }
                      if (lab.summary) {
                        return lab.summary;
                      }
                      return "Bring your Docker fundamentals to life with a focused, judge-backed challenge.";
                    })()}
                  </p>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="rounded-full border border-white/20 px-3 py-1 font-medium uppercase tracking-wide text-white/80">
                      {lab.slug}
                    </span>
                    {lab.has_starter ? (
                      <span className="rounded-full border border-emerald-400 px-3 py-1 font-medium text-emerald-200">
                        Starter files included
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-600 px-3 py-1 font-medium text-slate-300">
                        Manual setup
                      </span>
                    )}
                  </div>
                  <Link
                    className="inline-flex items-center justify-center rounded-full border border-sky-400 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 hover:text-white"
                    href={`/labs/${lab.slug}`}
                  >
                    Launch lab
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      <section id="learn" className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-white">Learn Docker</h2>
          <p className="mt-1 text-sm text-slate-400">
            Quick lessons to reinforce fundamentals before you jump back into the labs.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {learnTopics.map((topic, index) => (
            <motion.button
              key={topic.id}
              type="button"
              onClick={() => setSelectedTopic(topic)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ scale: 1.05, y: -8, rotateX: 5 }}
              style={{ transformStyle: "preserve-3d" }}
              className="card-shine group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/70 to-slate-900/50 p-6 text-left shadow-lg transition hover:border-white/30 hover:shadow-xl hover:shadow-sky-500/20"
            >
              <div
                className="absolute inset-0 opacity-20 transition group-hover:opacity-40"
                style={{
                  backgroundImage: `url('${topic.image}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                aria-hidden
              />
              <div className={`absolute inset-0 ${topic.tintClass} opacity-40 transition group-hover:opacity-60`} aria-hidden />
              <div className="relative space-y-4">
                <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  {topic.level}
                </span>
                <h3 className="text-lg font-semibold text-white">{topic.title}</h3>
                <p className="text-sm text-slate-300">{topic.summary}</p>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-sky-200">
                  Learn more
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      <Modal
        open={Boolean(selectedTopic)}
        onClose={() => setSelectedTopic(null)}
        title={selectedTopic?.title}
        size="lg"
        footer={
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-400">Ready to apply it? Pick a lab and start building.</span>
            <Link
              href="/dashboard#labs"
              onClick={() => setSelectedTopic(null)}
              className="inline-flex items-center justify-center rounded-full border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 hover:text-white"
            >
              Browse labs
            </Link>
          </div>
        }
      >
        {selectedTopic ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-200">{selectedTopic.summary}</p>
            <ul className="space-y-3 text-sm text-slate-200">
              {selectedTopic.content.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full bg-sky-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </motion.div>
  );
}
