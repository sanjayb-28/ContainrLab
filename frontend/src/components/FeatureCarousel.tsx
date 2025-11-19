"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Feature = {
  title: string;
  description: string;
  badge: string;
  image: string;
  tintClass: string;
};

const features: Feature[] = [
  {
    title: "Hands-on Docker practice",
    description: "Spin up real containers, edit files, and run the judge to validate your work—no local setup required.",
    badge: "Interactive",
    image: "https://illustrations.popsy.co/amber/woman-working-on-laptop.svg",
    tintClass: "bg-sky-500/25",
  },
  {
    title: "AI-guided coaching",
    description: "Gemini-powered hints, explanations, and patch suggestions help you unblock quickly while still learning.",
    badge: "AI Assist",
    image: "https://illustrations.popsy.co/amber/artificial-intelligence.svg",
    tintClass: "bg-purple-500/25",
  },
  {
    title: "Judge insights & metrics",
    description:
      "Gain confidence with structured judge results, delta comparisons, and inspector timelines for every attempt.",
    badge: "Insights",
    image: "https://illustrations.popsy.co/amber/analytics.svg",
    tintClass: "bg-emerald-500/25",
  },
];

export default function FeatureCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % features.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const current = useMemo(() => features[index], [index]);

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="group relative mt-16 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-1 shadow-xl backdrop-blur transition-all hover:border-sky-400/30 hover:shadow-2xl hover:shadow-sky-500/10"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
      </div>
      <div className="relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-[28px] bg-cover bg-center p-8 text-white md:p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${current.image}')` }}
          />
        </AnimatePresence>
        <div className={`absolute inset-0 rounded-[28px] ${current.tintClass}`} aria-hidden />
        <div
          className="absolute inset-0 rounded-[28px] bg-gradient-to-t from-slate-950/85 via-slate-950/55 to-slate-900/15"
          aria-hidden
        />
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="relative z-10"
          >
            <span className="inline-flex w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm">
              {current.badge}
            </span>
            <h3 className="mt-6 text-2xl font-semibold md:text-3xl">{current.title}</h3>
            <p className="mt-3 max-w-xl text-sm text-slate-100/90 md:text-base">{current.description}</p>

            <div className="mt-8 flex items-center gap-3">
              {features.map((feature, featureIndex) => (
                <button
                  key={feature.title}
                  type="button"
                  onClick={() => setIndex(featureIndex)}
                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                    featureIndex === index ? "bg-white shadow-lg shadow-white/50" : "bg-white/30 hover:bg-white/60"
                  }`}
                  aria-label={`Show feature: ${feature.title}`}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="absolute inset-y-0 left-0 z-20 flex items-center px-4">
        <motion.button
          type="button"
          onClick={() => setIndex((prev) => (prev - 1 + features.length) % features.length)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-full bg-slate-950/70 p-2 text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900/90 hover:shadow-xl"
          aria-label="Previous feature"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>
      </div>
      <div className="absolute inset-y-0 right-0 z-20 flex items-center px-4">
        <motion.button
          type="button"
          onClick={() => setIndex((prev) => (prev + 1) % features.length)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-full bg-slate-950/70 p-2 text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900/90 hover:shadow-xl"
          aria-label="Next feature"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </motion.button>
      </div>
    </motion.section>
  );
}
