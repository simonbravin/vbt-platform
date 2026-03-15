import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { Plus, FileText } from "lucide-react";
import { QuotesClient } from "./QuotesClient";
import type { SessionUser } from "@/lib/auth";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

const STATUS_KEYS: Record<string, string> = {
  draft: "quotes.draft",
  sent: "quotes.sent",
  accepted: "quotes.accepted",
  rejected: "quotes.rejected",
  expired: "quotes.expired",
};

export default async function QuotesPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await requireAuth();
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);

  const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
  const organizationId = effectiveOrgId ?? (user as { activeOrgId?: string; orgId?: string }).activeOrgId ?? (user as { orgId?: string }).orgId;
  if (!organizationId) return null;

  const quotes = await prisma.quote.findMany({
    where: {
      organizationId,
      ...(searchParams.status
        ? { status: searchParams.status as "draft" | "sent" | "accepted" | "rejected" | "expired" }
        : {}),
    },
    include: {
      project: {
        select: { projectName: true, id: true, countryCode: true, client: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const statuses = ["draft", "sent", "accepted", "rejected", "expired"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("quotes.title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t("quotes.quotesCount", { count: quotes.length })}</p>
        </div>
        <Link href="/quotes/create" className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600">
          <Plus className="w-4 h-4" /> {t("quotes.newQuote")}
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/quotes"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!searchParams.status ? "bg-vbt-blue text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
        >
          {t("quotes.all")}
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/quotes?status=${s}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${searchParams.status === s ? "bg-vbt-blue text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
          >
            {t(STATUS_KEYS[s] ?? s)}
          </Link>
        ))}
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t("quotes.noQuotes")}</p>
          <Link href="/quotes/create" className="text-vbt-orange text-sm hover:underline mt-2 block">
            {t("quotes.createFirstLink")}
          </Link>
        </div>
      ) : (
        <QuotesClient quotes={quotes} initialStatus={searchParams.status} />
      )}
    </div>
  );
}
