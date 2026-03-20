"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/context";

const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;

function quoteStatusLabel(t: (key: string) => string, status: string): string {
  if ((QUOTE_STATUSES as readonly string[]).includes(status)) {
    return t(`quotes.${status}`);
  }
  return status;
}

type QuoteDetail = {
  id: string;
  quoteNumber: string;
  status: string;
  totalPrice: number;
  factoryCostTotal: number;
  visionLatamMarkupPct: number;
  partnerMarkupPct: number;
  superadminComment?: string | null;
  reviewedAt?: string | null;
  organizationId: string;
  project?: {
    id: string;
    projectName: string;
    projectCode?: string | null;
    client?: { name: string } | null;
  };
  organization?: { name: string } | null;
  items?: Array<{
    id: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};

export function SuperadminQuoteDetailClient({ quoteId }: { quoteId: string }) {
  const { locale, t } = useLanguage();
  const dateLocale = locale === "es" ? "es" : "en";
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyTotalPrice, setModifyTotalPrice] = useState("");
  const [modifyVisionLatamPct, setModifyVisionLatamPct] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchQuote() {
      try {
        const res = await fetch(`/api/saas/quotes/${quoteId}`);
        if (!res.ok) {
          if (res.status === 404) setError(t("superadmin.quoteDetail.quoteNotFound"));
          else setError(t("superadmin.quoteDetail.failedToLoad"));
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setQuote(data);
          setModifyTotalPrice(String(data.totalPrice ?? ""));
          setModifyVisionLatamPct(String(data.visionLatamMarkupPct ?? ""));
        }
      } catch {
        if (!cancelled) setError(t("superadmin.quoteDetail.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchQuote();
    return () => { cancelled = true; };
  }, [quoteId, t]);

  const patch = async (body: { status?: string; superadminComment?: string | null; totalPrice?: number; visionLatamMarkupPct?: number }) => {
    setActionLoading("patch");
    try {
      const res = await fetch(`/api/saas/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error ?? t("superadmin.quoteDetail.failedToUpdate"));
        return;
      }
      const updated = await res.json();
      setQuote((prev) => (prev ? { ...prev, ...updated } : updated));
      setComment("");
      setModifyOpen(false);
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = () => {
    patch({ status: "accepted", superadminComment: comment.trim() || undefined });
  };

  const handleReject = () => {
    patch({ status: "rejected", superadminComment: comment.trim() || undefined });
  };

  const handleModifySubmit = () => {
    if (!comment.trim()) {
      alert(t("superadmin.quoteDetail.modifyRequiresCommentAlert"));
      return;
    }
    const total = modifyTotalPrice.trim() ? parseFloat(modifyTotalPrice) : undefined;
    const pct = modifyVisionLatamPct.trim() ? parseFloat(modifyVisionLatamPct) : undefined;
    if (total === undefined && pct === undefined) {
      setModifyOpen(false);
      return;
    }
    patch({
      ...(total !== undefined && { totalPrice: total }),
      ...(pct !== undefined && { visionLatamMarkupPct: pct }),
      superadminComment: comment.trim(),
    });
  };

  if (loading) return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (error || !quote) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 font-medium text-foreground">
        {error ?? t("superadmin.quoteDetail.notFound")}
      </div>
    );
  }

  const vlCommission = (quote.factoryCostTotal ?? 0) * (quote.visionLatamMarkupPct ?? 0) / 100;
  const basePriceForPartner = (quote.factoryCostTotal ?? 0) * (1 + (quote.visionLatamMarkupPct ?? 0) / 100);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">{t("superadmin.quoteDetail.quoteDataTitle")}</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.colQuoteNumber")}</dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground">{quote.quoteNumber}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.colOrganization")}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{(quote as { organization?: { name: string } }).organization?.name ?? quote.organizationId}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.colProject")}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{quote.project?.projectName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.colStatus")}</dt>
            <dd className="mt-0.5">
              <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                {quoteStatusLabel(t, quote.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.colFactoryCost")}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{formatCurrency(quote.factoryCostTotal ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.colVisionLatamPct")}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{quote.visionLatamMarkupPct ?? 0}%</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.colVlCommissionAmount")}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{formatCurrency(vlCommission)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.colBasePriceForPartner")}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{formatCurrency(basePriceForPartner)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.colTotalPrice")}</dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground">{formatCurrency(quote.totalPrice ?? 0)}</dd>
          </div>
        </dl>
        {quote.superadminComment && (
          <div className="mt-4 pt-4 border-t border-border">
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("superadmin.quoteDetail.lastSuperadminComment")}</dt>
            <dd className="mt-1 text-sm text-foreground">{quote.superadminComment}</dd>
            {quote.reviewedAt && (
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {t("superadmin.quoteDetail.reviewedAt", {
                  at: new Date(quote.reviewedAt).toLocaleString(dateLocale),
                })}
              </dd>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-2">{t("superadmin.quoteDetail.commentTitle")}</h2>
        <p className="text-sm text-muted-foreground mb-2">{t("superadmin.quoteDetail.commentHelp")}</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("superadmin.quotes.commentForPartnerPlaceholder")}
          className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {quote.status !== "accepted" && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={!!actionLoading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading ? "…" : t("superadmin.quoteDetail.approve")}
          </button>
        )}
        {quote.status !== "rejected" && (
          <button
            type="button"
            onClick={handleReject}
            disabled={!!actionLoading}
            title={!comment.trim() ? t("superadmin.quoteDetail.commentRequiredToReject") : undefined}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {actionLoading ? "…" : t("superadmin.quoteDetail.reject")}
          </button>
        )}
        <button
          type="button"
          onClick={() => setModifyOpen(!modifyOpen)}
          className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
        >
          {modifyOpen ? t("superadmin.quoteDetail.cancelModify") : t("superadmin.quoteDetail.modify")}
        </button>
      </div>

      {modifyOpen && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t("superadmin.quoteDetail.modifyTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("superadmin.quoteDetail.labelTotalPrice")}</label>
              <input
                type="number"
                value={modifyTotalPrice}
                onChange={(e) => setModifyTotalPrice(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("superadmin.quoteDetail.labelVisionLatamPct")}</label>
              <input
                type="number"
                value={modifyVisionLatamPct}
                onChange={(e) => setModifyVisionLatamPct(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                step="0.01"
                min="0"
                max="100"
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("superadmin.quoteDetail.modifyNote")}</p>
          <button
            type="button"
            onClick={handleModifySubmit}
            disabled={!!actionLoading}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {actionLoading ? t("superadmin.quoteDetail.saving") : t("superadmin.quoteDetail.saveChanges")}
          </button>
        </div>
      )}

      {quote.items && quote.items.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t("superadmin.quoteDetail.itemsTitle")}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 font-medium text-muted-foreground">{t("superadmin.quoteDetail.colDescription")}</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">{t("superadmin.quoteDetail.colQty")}</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">{t("superadmin.quoteDetail.colUnitPrice")}</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">{t("superadmin.quoteDetail.colLineTotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-foreground">{item.description ?? "—"}</td>
                    <td className="py-2 text-right text-foreground">{item.quantity}</td>
                    <td className="py-2 text-right text-foreground">{formatCurrency(item.unitPrice ?? 0)}</td>
                    <td className="py-2 text-right text-foreground">{formatCurrency(item.totalPrice ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
