import { requireAuth, formatCurrency } from "@/lib/utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";

export default async function QuotesPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await requireAuth();
  const orgId = (user as any).orgId;

  const quotes = await prisma.quote.findMany({
    where: {
      orgId,
      ...(searchParams.status ? { status: searchParams.status as any } : {}),
    },
    include: {
      project: { select: { name: true, client: true } },
      country: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const statuses = ["DRAFT", "SENT", "ARCHIVED", "CANCELLED"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{quotes.length} quotes</p>
        </div>
        <Link href="/quotes/new" className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600">
          <Plus className="w-4 h-4" /> New Quote
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/quotes"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!searchParams.status ? "bg-vbt-blue text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/quotes?status=${s}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${searchParams.status === s ? "bg-vbt-blue text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No quotes found</p>
          <Link href="/quotes/new" className="text-vbt-orange text-sm hover:underline mt-2 block">
            Create your first quote →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Quote #", "Project", "Destination", "Method", "Landed DDP", "Status", "Date"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="font-medium text-vbt-blue hover:underline">
                      {q.quoteNumber ?? q.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{q.project.name}</p>
                    {q.project.client && <p className="text-gray-400 text-xs">{q.project.client}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {q.country?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{q.costMethod}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {formatCurrency(q.landedDdpUsd)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      q.status === "SENT" ? "bg-green-100 text-green-700" :
                      q.status === "DRAFT" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>{q.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
