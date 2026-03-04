import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { QuotesClient } from "./QuotesClient";

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
        <QuotesClient quotes={quotes as any} initialStatus={searchParams.status} />
      )}
    </div>
  );
}
