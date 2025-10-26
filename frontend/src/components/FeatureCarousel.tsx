"use client";

import { useEffect, useMemo, useState } from "react";

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
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
    tintClass: "bg-sky-500/25",
  },
  {
    title: "AI-guided coaching",
    description: "Gemini-powered hints, explanations, and patch suggestions help you unblock quickly while still learning.",
    badge: "AI Assist",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    tintClass: "bg-purple-500/25",
  },
  {
    title: "Judge insights & metrics",
    description:
      "Gain confidence with structured judge results, delta comparisons, and inspector timelines for every attempt.",
    badge: "Insights",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
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
    <section className="relative mt-16 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-1 shadow-xl backdrop-blur">
      <div
        className="relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-[28px] bg-cover bg-center p-8 text-white md:p-12"
        style={{ backgroundImage: `url('${current.image}')` }}
      >
        <div className={`absolute inset-0 rounded-[28px] ${current.tintClass}`} aria-hidden />
        <div
          className="absolute inset-0 rounded-[28px] bg-gradient-to-t from-slate-950/85 via-slate-950/55 to-slate-900/15"
          aria-hidden
        />
        <div className="relative z-10">
        <span className="inline-flex w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
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
              className={`h-2 flex-1 rounded-full transition ${
                featureIndex === index ? "bg-white" : "bg-white/30 hover:bg-white/60"
              }`}
              aria-label={`Show feature: ${feature.title}`}
            />
          ))}
        </div>
        </div>
      </div>
      <div className="absolute inset-y-0 left-0 flex items-center px-4">
        <button
          type="button"
          onClick={() => setIndex((prev) => (prev - 1 + features.length) % features.length)}
          className="rounded-full bg-slate-950/70 p-2 text-white shadow-lg transition hover:bg-slate-900/90"
          aria-label="Previous feature"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center px-4">
        <button
          type="button"
          onClick={() => setIndex((prev) => (prev + 1) % features.length)}
          className="rounded-full bg-slate-950/70 p-2 text-white shadow-lg transition hover:bg-slate-900/90"
          aria-label="Next feature"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}
