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
import CollapsiblePanel from "@/components/ui/CollapsiblePanel";
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
        <nav>
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-full border border-sky-400 px-5 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 hover:text-white"
          >
            <span aria-hidden="true">&larr;</span>
            Back to all labs
          </Link>
        </nav>

        <CollapsiblePanel title="Lab overview" defaultOpen>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading description…</p>}>
            <Markdown content={lab.description} />
          </Suspense>
        </CollapsiblePanel>

        <LabActions slug={params.slug} initialSessionId={sessionId} />
        <WorkspacePane />
        <InspectorPanel />
        <AgentDrawer labSlug={params.slug} />
        <CollapsiblePanel
          title="Terminal"
          subtitle="Connected session appears after you start one from the controls."
        >
          <Terminal className="mt-3" />
        </CollapsiblePanel>

        {lab.solution ? (
          <CollapsiblePanel title="Solution" defaultOpen={false}>
            <Suspense fallback={<p className="text-sm text-slate-500">Loading solution…</p>}>
              <Markdown content={lab.solution} />
            </Suspense>
          </CollapsiblePanel>
        ) : null}
      </div>
    </LabSessionProvider>
  );
}
