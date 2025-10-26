import dynamicImport from "next/dynamic";
import { fetchLabs } from "@/lib/labs";

const DashboardView = dynamicImport(() => import("@/components/DashboardView"), { ssr: false });

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const labs = await fetchLabs();
  return <DashboardView labs={labs} />;
}
