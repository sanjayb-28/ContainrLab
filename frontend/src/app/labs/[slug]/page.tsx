import Link from "next/link";
import { Suspense } from "react";
import WorkspacePane from "@/components/WorkspacePane";
import InspectorPanel from "@/components/InspectorPanel";
import { notFound } from "next/navigation";
import LabActions from "@/components/LabActions";
import Terminal from "@/components/Terminal";
import Markdown from "@/components/Markdown";
import { fetchLab, fetchSession, LabDetail, SessionDetail } from "@/lib/labs";

type LabPageProps = {
  params: { slug: string };
  searchParams?: { session?: string | string[] };
};

export const dynamic = "force-dynamic";

async function loadData(
  slug: string,
  sessionId?: string
): Promise<{ lab: LabDetail; session: SessionDetail | null }> {
  let lab: LabDetail;
  try {
    lab = await fetchLab(slug);
  } catch (error) {
    if (error instanceof Error && (error as any).status === 404) {
      notFound();
    }
    throw error;
  }
  if (sessionId) {
    try {
      const detail = await fetchSession(sessionId);
      return { lab, session: detail };
    } catch {
      // swallow session errors to keep the page usable
      return { lab, session: null };
    }
  }
  return { lab, session: null };
}

export default async function LabPage({ params, searchParams }: LabPageProps) {
  const sessionQuery = searchParams?.session;
  const sessionId = Array.isArray(sessionQuery)
    ? sessionQuery[0]
    : sessionQuery;

  const { lab, session } = await loadData(params.slug, sessionId);

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-400">
        <Link href="/" className="text-sky-400 hover:text-sky-300">
          &larr; Back to all labs
        </Link>
      </nav>

      <header className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-2xl font-semibold text-slate-100">
          {lab.title || lab.slug}
        </h1>
        {lab.summary ? (
          <p className="text-slate-300">{lab.summary}</p>
        ) : (
          <p className="text-slate-500">No summary yet.</p>
        )}
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <span>
            Slug: <code>{lab.slug}</code>
          </span>
          <span>
            Starter:{" "}
            <span className="font-medium">
              {lab.has_starter ? "Available" : "Missing"}
            </span>
          </span>
        </div>
      </header>

      <LabActions slug={params.slug} initialSession={session} />
      <WorkspacePane sessionId={session?.session_id} />
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <InspectorPanel sessionId={session?.session_id} />
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Terminal</h2>
        <p className="text-sm text-slate-400">
          Connected to session: {session?.session_id ?? "(start a session to use the terminal)"}
        </p>
        <Terminal sessionId={session?.session_id} className="mt-4" />
      </div>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-slate-100">README</h2>
        <Suspense fallback={<p className="text-sm text-slate-500">Loading...</p>}>
          <Markdown content={lab.readme} />
        </Suspense>
      </section>
    </div>
  );
}
