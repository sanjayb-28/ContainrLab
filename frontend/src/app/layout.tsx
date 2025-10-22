import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      <body className={`${inter.className} bg-slate-950 text-slate-200`}>
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-16 pt-10">
          <header className="mb-8 flex flex-col gap-1 border-b border-slate-800 pb-6">
            <h1 className="text-3xl font-semibold text-sky-300">ContainrLab</h1>
            <p className="text-slate-400">
              Learn Docker by building and testing real containers.
            </p>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="mt-8 border-t border-slate-900 pt-4 text-sm text-slate-500">
            <span>API base: {process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"}</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
