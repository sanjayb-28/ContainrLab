"use client";

import Link from "next/link";

type LogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "h-8 w-8 text-base",
  md: "h-10 w-10 text-lg",
  lg: "h-12 w-12 text-xl",
};

export default function Logo({ href = "/", size = "md" }: LogoProps) {
  const logo = (
    <div className="flex items-center gap-3">
      <div
        className={`flex ${sizeClasses[size]} items-center justify-center rounded-2xl border border-sky-400/40 bg-slate-900/80 text-white shadow-lg`}
      >
        <span className="font-black tracking-tight">CL</span>
      </div>
      <span className="text-lg font-semibold text-white md:text-xl">ContainrLab</span>
    </div>
  );

  if (!href) {
    return logo;
  }

  return (
    <Link href={href} className="inline-flex items-center gap-3">
      {logo}
    </Link>
  );
}
