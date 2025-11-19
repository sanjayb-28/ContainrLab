"use client";

import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type CollapsiblePanelProps = {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
};

export default function CollapsiblePanel({
  title,
  subtitle,
  className = "",
  children,
  defaultOpen = true,
  actions,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`card-shine rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-lg backdrop-blur-xl transition hover:border-white/20 ${className}`}
    >
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <motion.button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="btn-ripple inline-flex items-center gap-2 rounded-full border border-white/15 bg-gradient-to-r from-white/5 to-transparent px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:from-white/10"
            aria-expanded={open}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {title}
          </motion.button>
          {subtitle ? <p className="mt-2 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-4 text-sm text-slate-200">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
