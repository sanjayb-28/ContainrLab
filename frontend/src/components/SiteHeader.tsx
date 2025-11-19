"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import { useAuth } from "@/components/AuthProvider";

type NavLink = {
  href: string;
  label: string;
  requiresAuth?: boolean;
};

const navLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard", requiresAuth: true },
  { href: "/dashboard#learn", label: "Learn Docker", requiresAuth: true },
];

const buttonClasses =
  "inline-flex items-center justify-center rounded-full border border-sky-400 px-5 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-slate-950";

function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initials = useMemo(() => user?.email?.slice(0, 2).toUpperCase() ?? "CL", [user?.email]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-500 bg-slate-900/80 text-sm font-semibold uppercase text-slate-200 shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-slate-950"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials}
      </button>
      {open ? (
        <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-xl ring-1 ring-white/10">
          <div className="border-b border-white/10 p-4">
            <p className="text-sm font-semibold text-white">{user?.email}</p>
            <p className="mt-1 text-xs text-slate-400">User ID: {user?.user_id}</p>
            {user?.last_login_at ? (
              <p className="mt-1 text-xs text-slate-500">
                Last seen: {new Date(user.last_login_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          <nav className="flex flex-col p-2 text-sm">
            <Link
              href="/dashboard"
              className="rounded-xl px-3 py-2 text-slate-200 transition hover:bg-slate-800/70"
              onClick={() => setOpen(false)}
            >
              Go to Dashboard
            </Link>
            <Link
              href="/"
              className="rounded-xl px-3 py-2 text-slate-200 transition hover:bg-slate-800/70"
              onClick={() => setOpen(false)}
            >
              Home
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="mt-2 rounded-xl bg-slate-800/80 px-3 py-2 text-left text-slate-200 transition hover:bg-red-500/80 hover:text-white"
            >
              Sign out
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { token, login } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-4">
          <Logo size="md" />
          <nav className="hidden items-center gap-2 md:-ml-1 md:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href || (link.href.includes("#") && pathname === link.href.split("#")[0]);
            const disabled = link.requiresAuth && !token;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  disabled
                    ? "cursor-not-allowed bg-white/5 text-slate-500"
                    : active
                    ? "bg-white/15 text-white shadow-inner"
                    : "bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
                aria-disabled={disabled}
              >
                {link.label}
              </Link>
            );
          })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {!token ? (
            <>
              <button
                type="button"
                onClick={() => login()}
                className="hidden rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10 md:inline-flex"
              >
                Sign in
              </button>
              <button type="button" onClick={() => login()} className={buttonClasses}>
                Sign up free
              </button>
            </>
          ) : (
            <ProfileMenu />
          )}
        </div>
      </div>
    </header>
  );
}
