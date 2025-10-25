import Link from "next/link";
import { fetchLabs, type LabSummary } from "@/lib/labs";
import { DISPLAY_API_BASE } from "@/lib/api";

export default async function Home() {
  let labs: LabSummary[] = [];
  let error: string | null = null;

  try {
    labs = await fetchLabs();
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Unable to contact the ContainrLab API.";
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold text-slate-100">Labs</h2>
        <p className="text-sm text-slate-400">
          API: <code className="text-slate-300">{DISPLAY_API_BASE}</code>
        </p>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </p>
      ) : labs.length === 0 ? (
        <p className="text-slate-400">
          No labs found yet. Add content under <code>labs/</code>.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {labs.map((lab) => (
            <li key={lab.slug} className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">
                  <Link href={`/labs/${lab.slug}`}>{lab.title || lab.slug}</Link>
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    lab.has_starter ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {lab.has_starter ? "Starter" : "No starter"}
                </span>
              </div>
              {lab.summary ? (
                <p className="mt-2 text-sm text-slate-300">{lab.summary}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No summary yet. Update <code>labs/{lab.slug}/README.md</code>.
                </p>
              )}
              <div className="mt-4 text-sm text-slate-400">
                <code>{lab.slug}</code>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
