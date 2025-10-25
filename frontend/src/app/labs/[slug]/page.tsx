import Link from "next/link";
import { Suspense } from "react";
import WorkspacePane from "@/components/WorkspacePane";
import InspectorPanel from "@/components/InspectorPanel";
import AgentDrawer from "@/components/AgentDrawer";
import { LabSessionProvider } from "@/components/LabSessionProvider";
import { notFound } from "next/navigation";
import LabActions from "@/components/LabActions";
import Terminal from "@/components/Terminal";
import Markdown from "@/components/Markdown";
import { fetchLab, LabDetail } from "@/lib/labs";

type LabPageProps = {
  params: { slug: string };
  searchParams?: { session?: string | string[] };
};

export const dynamic = "force-dynamic";

async function loadLab(slug: string): Promise<LabDetail> {
  try {
    return await fetchLab(slug);
  } catch (error) {
    if (error instanceof Error && (error as any).status === 404) {
      notFound();
    }
    throw error;
  }
}

export default async function LabPage({ params, searchParams }: LabPageProps) {
  const sessionQuery = searchParams?.session;
  const sessionId = Array.isArray(sessionQuery)
    ? sessionQuery[0]
    : sessionQuery;

  const lab = await loadLab(params.slug);

  return (
    <LabSessionProvider initialSessionId={sessionId}>
      <div className="space-y-8">
        <nav className="text-sm text-slate-400">
          <Link href="/" className="text-sky-400 hover:text-sky-300">
            &larr; Back to all labs
          </Link>
        </nav>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-slate-100">Description</h2>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading description…</p>}>
            <Markdown content={lab.description} />
          </Suspense>
        </section>

        <LabActions slug={params.slug} initialSessionId={sessionId} />
        <WorkspacePane />
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <InspectorPanel />
        </div>
        <AgentDrawer labSlug={params.slug} />
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Terminal</h2>
          <p className="text-sm text-slate-400">
            Connected session appears after you start one from the controls.
          </p>
          <Terminal className="mt-4" />
        </div>

        {lab.solution ? (
          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-slate-100">Solution</h2>
            <Suspense fallback={<p className="text-sm text-slate-500">Loading solution…</p>}>
              <Markdown content={lab.solution} />
            </Suspense>
          </section>
        ) : null}
      </div>
    </LabSessionProvider>
  );
}
