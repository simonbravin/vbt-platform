import { requireAuth, formatCurrency } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Plus } from "lucide-react";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      quotes: {
        include: { country: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {project.client && <p className="text-gray-500 text-sm">{project.client} · {project.location}</p>}
        </div>
      </div>

      {/* Wall Areas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "S80", value: project.wallAreaM2S80 },
          { label: "S150", value: project.wallAreaM2S150 },
          { label: "S200", value: project.wallAreaM2S200 },
          { label: "Total", value: project.wallAreaM2Total },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 uppercase">{s.label} Wall Area</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{s.value.toFixed(1)} m²</p>
          </div>
        ))}
      </div>

      {/* Quotes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Quotes ({project.quotes.length})</h2>
          <Link
            href={`/quotes/new?projectId=${project.id}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            <Plus className="w-3.5 h-3.5" /> New Quote
          </Link>
        </div>

        {project.quotes.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No quotes for this project</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {project.quotes.map((q) => (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-800">{q.quoteNumber ?? q.id.slice(0, 8)}</p>
                  <p className="text-gray-400 text-xs">
                    {q.costMethod} · {q.country?.name ?? "No destination"} ·{" "}
                    {new Date(q.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">{formatCurrency(q.landedDdpUsd)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    q.status === "SENT" ? "bg-green-100 text-green-700" :
                    q.status === "DRAFT" ? "bg-amber-100 text-amber-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{q.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
