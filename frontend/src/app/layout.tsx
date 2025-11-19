import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import SiteHeader from "@/components/SiteHeader";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import FloatingParticles from "@/components/ui/FloatingParticles";
import CursorGlow from "@/components/ui/CursorGlow";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ContainrLab",
  description: "Hands-on container lessons",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} relative overflow-x-hidden bg-slate-950 text-slate-200 antialiased`}>
        <AnimatedBackground />
        <FloatingParticles />
        <CursorGlow />
        <AuthProvider>
          <div className="relative z-10 flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">
              <div className="mx-auto w-full max-w-6xl px-6 py-12">{children}</div>
            </main>
            <footer className="border-t border-white/10 bg-slate-950/60 py-6">
              <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-400 md:flex-row">
                <p>© {new Date().getFullYear()} ContainrLab. Learn by building.</p>
                <div className="flex gap-4">
                  <a
                    href="https://github.com/sanjayb-28/ContainrLab"
                    className="rounded-full border border-white/10 px-4 py-2 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                  >
                    GitHub
                  </a>
                  <a
                    href="mailto:sanjay.baskaran@colorado.edu"
                    className="rounded-full border border-white/10 px-4 py-2 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                  >
                    Contact
                  </a>
                </div>
                <p className="text-xs text-slate-500">Made with love by Sanjay Baskaran.</p>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
