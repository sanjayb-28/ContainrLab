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
import LabPageClient from "@/components/LabPageClient";

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
      <LabPageClient
        slug={params.slug}
        sessionId={sessionId}
        labDescription={lab.description}
        labSolution={lab.solution}
      />
    </LabSessionProvider>
  );
}
