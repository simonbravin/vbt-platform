"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { INVOICED_BASIS_OPTIONS } from "@/lib/sales";
import { saasQuoteRowToLegacySaleShape, type LegacySaleQuoteRow } from "@/lib/saas-quote-legacy-sale-shape";
import { aggregateSaleFinancialsFromQuoteRows, normalizeQuoteStatus, type SaleQuoteFinancialRow } from "@vbt/core";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type Client = { id: string; name: string };
type Project = {
  id: string;
  name: string;
  clientId: string | null;
  projectName?: string;
  baselineQuoteId?: string | null;
  baselineQuote?: { id: string; quoteNumber: string } | null;
};
type Quote = LegacySaleQuoteRow;
type Entity = { id: string; name: string; slug: string };

type InvoiceLine = { entityId: string; amountUsd: number; dueDate: string; sequence: number; referenceNumber: string; notes: string };

export type NewSaleClientProps = {
  /** Superadmin: target partner org. Omit for distributor session. */
  scopedOrganizationId?: string;
  backHref?: string;
  cancelHref?: string;
  successPath?: (saleId: string) => string;
};

export function NewSaleClient({
  scopedOrganizationId,
  backHref = "/sales",
  cancelHref = "/sales",
  successPath = (id) => `/sales/${id}`,
}: NewSaleClientProps = {}) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [clientId, setClientId] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [quoteId, setQuoteId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"DRAFT" | "CONFIRMED">("DRAFT");
  const [exwUsd, setExwUsd] = useState(0);
  const [commissionPct, setCommissionPct] = useState(0);
  const [commissionAmountUsd, setCommissionAmountUsd] = useState(0);
  const [fobUsd, setFobUsd] = useState(0);
  const [freightUsd, setFreightUsd] = useState(0);
  const [cifUsd, setCifUsd] = useState(0);
  const [taxesFeesUsd, setTaxesFeesUsd] = useState(0);
  const [landedDdpUsd, setLandedDdpUsd] = useState(0);
  const [invoicedBasis, setInvoicedBasis] = useState<"EXW" | "FOB" | "CIF" | "DDP">("DDP");
  const [notes, setNotes] = useState("");
  const [invoices, setInvoices] = useState<InvoiceLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [multiHasDraftBaseline, setMultiHasDraftBaseline] = useState(false);
  /** Evita reasignar cotización tras elección manual del usuario en el mismo proyecto. */
  const quotePickInitializedForProjectRef = useRef<string | null>(null);

  useEffect(() => {
    const orgParam = scopedOrganizationId
      ? `&organizationId=${encodeURIComponent(scopedOrganizationId)}`
      : "";
    fetch(`/api/clients?limit=500${orgParam}`)
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []));
    fetch(`/api/saas/projects?limit=500${orgParam}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
    const entUrl = scopedOrganizationId
      ? `/api/sales/entities?organizationId=${encodeURIComponent(scopedOrganizationId)}`
      : "/api/sales/entities";
    fetch(entUrl)
      .then((r) => r.json())
      .then((d) => setEntities(Array.isArray(d) ? d : []));
  }, [scopedOrganizationId]);

  const urlQuoteId = searchParams.get("quoteId");
  const urlProjectId = searchParams.get("projectId");
  const urlClientId = searchParams.get("clientId");
  const projectId = selectedProjectIds[0] ?? "";

  useEffect(() => {
    if (urlProjectId) setSelectedProjectIds([urlProjectId]);
    if (urlClientId) setClientId(urlClientId);
    if (urlQuoteId) {
      setQuoteId(urlQuoteId);
      if (urlProjectId) quotePickInitializedForProjectRef.current = urlProjectId;
    }
  }, [urlQuoteId, urlProjectId, urlClientId]);

  useEffect(() => {
    quotePickInitializedForProjectRef.current = null;
  }, [projectId]);

  const projectsForClient = clientId
    ? projects.filter((p) => p.clientId === clientId || !p.clientId)
    : projects;

  useEffect(() => {
    if (!projectId || selectedProjectIds.length !== 1) {
      setQuotes([]);
      if (selectedProjectIds.length !== 1) {
        setQuoteId("");
        quotePickInitializedForProjectRef.current = null;
      }
      return;
    }
    let cancelled = false;
    fetch(
      `/api/saas/quotes?projectId=${projectId}&limit=50${
        scopedOrganizationId ? `&organizationId=${encodeURIComponent(scopedOrganizationId)}` : ""
      }`
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const raw = Array.isArray(d) ? d : d.quotes ?? [];
        const list = raw.map((row: Record<string, unknown>) => saasQuoteRowToLegacySaleShape(row));
        setQuotes(list);

        if (urlQuoteId && list.some((x: { id: string }) => x.id === urlQuoteId)) {
          setQuoteId(urlQuoteId);
          quotePickInitializedForProjectRef.current = projectId;
          return;
        }
        if (quotePickInitializedForProjectRef.current === projectId) return;

        const proj = projects.find((p) => p.id === projectId);
        const baselineId = proj?.baselineQuoteId ?? proj?.baselineQuote?.id;
        if (baselineId && list.some((x: { id: string }) => x.id === baselineId)) {
          setQuoteId(baselineId);
        } else if (list.length > 0) {
          setQuoteId(list[0]!.id);
        } else {
          setQuoteId("");
        }
        quotePickInitializedForProjectRef.current = projectId;
      })
      .catch(() => {
        if (!cancelled) setQuotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedProjectIds.length, urlQuoteId, scopedOrganizationId, projects]);

  useEffect(() => {
    if (selectedProjectIds.length < 2 || !clientId) {
      setMultiHasDraftBaseline(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows: SaleQuoteFinancialRow[] = [];
      let anyDraft = false;
      for (const pid of selectedProjectIds) {
        const proj = projects.find((p) => p.id === pid);
        const bid = proj?.baselineQuoteId ?? proj?.baselineQuote?.id;
        if (!bid) continue;
        const qUrl = `/api/saas/quotes/${bid}${
          scopedOrganizationId ? `?organizationId=${encodeURIComponent(scopedOrganizationId)}` : ""
        }`;
        const res = await fetch(qUrl);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) continue;
        if (normalizeQuoteStatus((raw as { status?: string }).status) === "draft") {
          anyDraft = true;
        }
        const legacy = saasQuoteRowToLegacySaleShape(raw as Record<string, unknown>);
        rows.push({
          factoryCostUsd: legacy.factoryCostUsd,
          commissionPct: legacy.commissionPct,
          fobUsd: legacy.fobUsd,
          freightCostUsd: legacy.freightCostUsd,
          cifUsd: legacy.cifUsd,
          taxesFeesUsd: legacy.taxesFeesUsd,
          landedDdpUsd: legacy.landedDdpUsd,
        });
      }
      if (cancelled) return;
      if (rows.length !== selectedProjectIds.length) {
        setMultiHasDraftBaseline(false);
        return;
      }
      setMultiHasDraftBaseline(anyDraft);
      const agg = aggregateSaleFinancialsFromQuoteRows(rows, quantity);
      setExwUsd(agg.exwUsd);
      setCommissionPct(agg.commissionPct);
      setCommissionAmountUsd(agg.commissionAmountUsd);
      setFobUsd(agg.fobUsd);
      setFreightUsd(agg.freightUsd);
      setCifUsd(agg.cifUsd);
      setTaxesFeesUsd(agg.taxesFeesUsd);
      setLandedDdpUsd(agg.landedDdpUsd);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectIds, quantity, projects, clientId, scopedOrganizationId]);

  useEffect(() => {
    if (selectedProjectIds.length !== 1) return;
    if (!quoteId || quotes.length === 0) return;
    const q = quotes.find((x) => x.id === quoteId);
    if (!q) return;
    const mult = quantity;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    setExwUsd(round2(q.factoryCostUsd * mult));
    setCommissionPct(round2(q.commissionPct));
    setCommissionAmountUsd(round2((q.fobUsd - q.factoryCostUsd) * mult));
    setFobUsd(round2(q.fobUsd * mult));
    setFreightUsd(round2(q.freightCostUsd * mult));
    setCifUsd(round2(q.cifUsd * mult));
    setTaxesFeesUsd(round2(q.taxesFeesUsd * mult));
    setLandedDdpUsd(round2(q.landedDdpUsd * mult));
  }, [quoteId, quantity, quotes, selectedProjectIds.length]);

  const validateFinancials = () => {
    if (exwUsd < 0 || fobUsd < 0 || cifUsd < 0 || landedDdpUsd < 0) return t("partner.sales.new.validation.nonNegative");
    if (landedDdpUsd < cifUsd) return t("partner.sales.new.validation.ddpGteCif");
    if (cifUsd < fobUsd) return t("partner.sales.new.validation.cifGteFob");
    if (fobUsd < exwUsd) return t("partner.sales.new.validation.fobGteExw");
    return null;
  };

  const getMaxInvoiced = () => {
    const b = (invoicedBasis || "DDP").toUpperCase();
    if (b === "EXW") return exwUsd;
    if (b === "FOB") return fobUsd;
    if (b === "CIF") return cifUsd;
    return landedDdpUsd;
  };

  const projectHasBaseline = (p: Project) => Boolean(p.baselineQuoteId ?? p.baselineQuote?.id);

  const isProjectDisabledForMulti = (p: Project) => {
    if (selectedProjectIds.includes(p.id)) return false;
    if (selectedProjectIds.length === 0) return false;
    return !projectHasBaseline(p);
  };

  const toggleProjectSelection = (id: string) => {
    if (selectedProjectIds.includes(id)) {
      setSelectedProjectIds((prev) => prev.filter((x) => x !== id));
      return;
    }
    const proj = projectsForClient.find((p) => p.id === id);
    if (!proj) return;
    if (selectedProjectIds.length >= 1 && !projectHasBaseline(proj)) return;
    setSelectedProjectIds((prev) => [...prev, id]);
  };

  const showDraftQuoteWarning = useMemo(() => {
    if (selectedProjectIds.length >= 2) return multiHasDraftBaseline;
    if (selectedProjectIds.length !== 1 || !quoteId) return false;
    const q = quotes.find((x) => x.id === quoteId);
    return normalizeQuoteStatus(q?.status) === "draft";
  }, [selectedProjectIds.length, quoteId, quotes, multiHasDraftBaseline]);

  const quoteOptionLabel = useCallback(
    (q: Quote) => {
      const base = `${q.quoteNumber ?? q.id.slice(0, 8)} – ${formatCurrency(q.landedDdpUsd)}`;
      if (normalizeQuoteStatus(q.status) === "draft") {
        return `${base} (${t("partner.sales.new.quoteDraftSuffix")})`;
      }
      return base;
    },
    [t]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!clientId || selectedProjectIds.length === 0) {
      setError(t("partner.sales.new.errorClientProjectRequired"));
      return;
    }
    if (selectedProjectIds.length >= 2) {
      for (const id of selectedProjectIds) {
        const p = projects.find((x) => x.id === id);
        if (!p || !projectHasBaseline(p)) {
          setError(t("partner.sales.new.projectNeedsBaseline"));
          return;
        }
      }
    }
    const validationErr = validateFinancials();
    if (validationErr) {
      setError(validationErr);
      return;
    }
    const validInvoices = invoices.filter((inv) => inv.entityId && inv.amountUsd >= 0);
    const invoicesSum = validInvoices.reduce((a, inv) => a + Number(inv.amountUsd), 0);
    const maxInvoiced = getMaxInvoiced();
    if (validInvoices.length > 0 && invoicesSum > maxInvoiced) {
      setError(
        t("partner.sales.new.errorInvoiceCap", {
          sum: invoicesSum.toFixed(2),
          max: maxInvoiced.toFixed(2),
        })
      );
      return;
    }
    setSaving(true);
    try {
      const isMulti = selectedProjectIds.length >= 2;
      const payload: Record<string, unknown> = {
        clientId,
        quantity,
        status,
        invoicedBasis,
        notes: notes || undefined,
        ...(scopedOrganizationId ? { organizationId: scopedOrganizationId } : {}),
        invoices: invoices
          .filter((inv) => inv.entityId && inv.amountUsd >= 0)
          .map((inv) => ({
            entityId: inv.entityId,
            amountUsd: Number(Number(inv.amountUsd).toFixed(2)),
            dueDate: inv.dueDate || undefined,
            sequence: inv.sequence || 1,
            referenceNumber: inv.referenceNumber?.trim() || undefined,
            notes: inv.notes || undefined,
          })),
      };
      if (isMulti) {
        payload.projectLines = selectedProjectIds.map((pid) => ({ projectId: pid }));
      } else {
        payload.projectId = selectedProjectIds[0];
        payload.quoteId = quoteId || undefined;
        payload.exwUsd = Number(exwUsd.toFixed(2));
        payload.commissionPct = Number(commissionPct.toFixed(2));
        payload.commissionAmountUsd = Number(commissionAmountUsd.toFixed(2));
        payload.fobUsd = Number(fobUsd.toFixed(2));
        payload.freightUsd = Number(freightUsd.toFixed(2));
        payload.cifUsd = Number(cifUsd.toFixed(2));
        payload.taxesFeesUsd = Number(taxesFeesUsd.toFixed(2));
        payload.landedDdpUsd = Number(landedDdpUsd.toFixed(2));
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) throw new Error((data as { error?: string }).error ?? t("partner.sales.new.failedToCreate"));
      router.push(successPath((data as { id: string }).id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("partner.sales.new.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="flex gap-4">
        <Link href={backHref} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="w-4 h-4" /> {t("partner.sales.backToSales")}
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-alert-errorBorder bg-alert-error p-3 text-sm text-foreground">
          {error}
        </div>
      )}

      {showDraftQuoteWarning && (
        <div className="rounded-lg border border-alert-warningBorder bg-alert-warning p-3 text-sm text-foreground">
          {t("partner.sales.new.draftQuoteWarning")}
        </div>
      )}

      <div className="surface-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground">{t("partner.sales.new.sectionDetails")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("partner.sales.new.clientLabel")}</label>
            <FilterSelect
              value={clientId}
              onValueChange={(v) => {
                setClientId(v);
                setSelectedProjectIds([]);
                setQuoteId("");
                quotePickInitializedForProjectRef.current = null;
              }}
              emptyOptionLabel={t("partner.sales.new.selectClient")}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              aria-label={t("partner.sales.new.clientLabel")}
              triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">{t("partner.sales.new.projectLabel")}</label>
            <p className="text-xs text-muted-foreground mb-2">{t("partner.sales.new.projectsMultiHint")}</p>
            {!clientId ? (
              <p className="text-sm text-muted-foreground">{t("partner.sales.new.selectClient")}</p>
            ) : projectsForClient.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("partner.sales.new.noProjectsForClient")}</p>
            ) : (
              <ul className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-3">
                {projectsForClient.map((p) => {
                  const label = p.projectName ?? p.name ?? p.id.slice(0, 8);
                  const disabled = isProjectDisabledForMulti(p);
                  const checked = selectedProjectIds.includes(p.id);
                  return (
                    <li key={p.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        id={`sale-proj-${p.id}`}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleProjectSelection(p.id)}
                        className="mt-1"
                      />
                      <label htmlFor={`sale-proj-${p.id}`} className={disabled ? "text-muted-foreground" : "cursor-pointer text-foreground"}>
                        {label}
                        {disabled && (
                          <span className="ml-2 text-xs text-muted-foreground">({t("partner.sales.new.projectNeedsBaselineShort")})</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {selectedProjectIds.length === 1 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("partner.sales.new.quoteOptional")}</label>
              <FilterSelect
                value={quoteId}
                onValueChange={(v) => {
                  setQuoteId(v);
                  if (projectId) quotePickInitializedForProjectRef.current = projectId;
                }}
                emptyOptionLabel={t("partner.sales.new.quoteNoneManual")}
                options={quotes.map((q) => ({
                  value: q.id,
                  label: quoteOptionLabel(q),
                }))}
                aria-label={t("partner.sales.new.quoteOptional")}
                triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("partner.sales.new.quantity")}</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("partner.sales.colStatus")}</label>
            <FilterSelect
              value={status}
              onValueChange={(v) => setStatus(v as "DRAFT" | "CONFIRMED")}
              options={[
                { value: "DRAFT", label: t("partner.sales.status.DRAFT") },
                { value: "CONFIRMED", label: t("partner.sales.status.CONFIRMED") },
              ]}
              aria-label={t("partner.sales.colStatus")}
              triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("partner.sales.new.salesConditionLabel")}</label>
            <FilterSelect
              value={invoicedBasis}
              onValueChange={(v) => setInvoicedBasis(v as "EXW" | "FOB" | "CIF" | "DDP")}
              options={INVOICED_BASIS_OPTIONS.map((b) => ({ value: b, label: b }))}
              aria-label={t("partner.sales.new.salesConditionLabel")}
              triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
            />
            <p className="text-xs text-muted-foreground mt-0.5">{t("partner.sales.new.salesConditionHelp")}</p>
          </div>
        </div>
      </div>

      <div className="surface-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground">{t("partner.sales.new.sectionFinancials")}</h2>
        {selectedProjectIds.length >= 2 && (
          <p className="text-xs text-muted-foreground">{t("partner.sales.new.financialsMultiHint")}</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              ["partner.sales.new.fin.exw", exwUsd, setExwUsd, true],
              ["partner.sales.new.fin.commissionPct", commissionPct, setCommissionPct, false],
              ["partner.sales.new.fin.commissionAmount", commissionAmountUsd, setCommissionAmountUsd, true],
              ["partner.sales.new.fin.fob", fobUsd, setFobUsd, true],
              ["partner.sales.new.fin.freight", freightUsd, setFreightUsd, true],
              ["partner.sales.new.fin.cif", cifUsd, setCifUsd, true],
              ["partner.sales.new.fin.taxesFees", taxesFeesUsd, setTaxesFeesUsd, true],
              ["partner.sales.new.fin.landedDdp", landedDdpUsd, setLandedDdpUsd, true],
            ] as [string, number, (n: number) => void, boolean][]
          ).map(([labelKey, val, setter, isCurrency]) => (
            <div key={labelKey}>
              <label className="block text-sm font-medium text-foreground mb-1">{t(labelKey)}</label>
              {isCurrency ? (
                <div className="relative rounded-lg border border-input">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    disabled={selectedProjectIds.length >= 2}
                    value={typeof val === "number" ? Number(val.toFixed(2)) : ""}
                    onChange={(e) => (setter as (n: number) => void)(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border-0 text-sm bg-transparent disabled:opacity-60"
                  />
                </div>
              ) : (
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  disabled={selectedProjectIds.length >= 2}
                  value={typeof val === "number" ? Number(val.toFixed(2)) : ""}
                  onChange={(e) => (setter as (n: number) => void)(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm disabled:opacity-60"
                />
              )}
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("common.notes")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg text-sm"
            rows={2}
          />
        </div>
      </div>

      <div className="surface-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{t("partner.sales.new.sectionInvoices")}</h2>
          <button
            type="button"
            onClick={() => setInvoices((prev) => [...prev, { entityId: "", amountUsd: 0, dueDate: "", sequence: prev.length + 1, referenceNumber: "", notes: "" }])}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg"
          >
            <Plus className="w-4 h-4" /> {t("partner.sales.new.addLine")}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t("partner.sales.new.invoicesHint")}</p>
        {invoices.filter((i) => i.entityId).length > 0 && (() => {
          const sum = invoices.filter((i) => i.entityId).reduce((a, i) => a + Number(i.amountUsd), 0);
          const max = getMaxInvoiced();
          return sum > max ? (
            <p className="text-sm text-muted-foreground">
              {t("partner.sales.new.invoiceSumExceeds", {
                sum: sum.toFixed(2),
                basis: invoicedBasis,
                max: max.toFixed(2),
              })}
            </p>
          ) : null;
        })()}
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("partner.sales.new.noInvoiceLines")}</p>
        ) : (
          <ul className="space-y-3">
            {invoices.map((inv, idx) => (
              <li key={idx} className="flex flex-wrap items-end gap-2 p-3 bg-muted/30 rounded-lg">
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-0.5">{t("partner.sales.new.entity")}</label>
                  <FilterSelect
                    value={inv.entityId}
                    onValueChange={(v) =>
                      setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, entityId: v } : p)))
                    }
                    emptyOptionLabel={t("partner.sales.new.selectEntity")}
                    options={entities.map((e) => ({ value: e.id, label: e.name }))}
                    aria-label={t("partner.sales.new.entity")}
                    triggerClassName="h-9 w-full min-w-0 max-w-full text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-muted-foreground mb-0.5">{t("partner.sales.new.amountUsd")}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={inv.amountUsd === 0 ? "" : inv.amountUsd}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, amountUsd: parseFloat(e.target.value) || 0 } : p)))}
                    className="w-full px-2 py-1.5 border border-input rounded-lg text-sm"
                  />
                </div>
                <div className="w-36">
                  <label className="block text-xs font-medium text-muted-foreground mb-0.5">{t("partner.sales.new.dueDate")}</label>
                  <input
                    type="date"
                    value={inv.dueDate}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, dueDate: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-input rounded-lg text-sm"
                  />
                </div>
                <div className="w-16">
                  <label className="block text-xs font-medium text-muted-foreground mb-0.5">{t("partner.sales.new.seq")}</label>
                  <input
                    type="number"
                    min={1}
                    value={inv.sequence}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, sequence: parseInt(e.target.value, 10) || 1 } : p)))}
                    className="w-full px-2 py-1.5 border border-input rounded-lg text-sm"
                  />
                </div>
                <div className="min-w-[120px] flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-0.5">{t("partner.sales.new.refNumber")}</label>
                  <input
                    type="text"
                    value={inv.referenceNumber}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, referenceNumber: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-input rounded-lg text-sm"
                    placeholder={t("partner.sales.new.externalInvoicePlaceholder")}
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs font-medium text-muted-foreground mb-0.5">{t("common.notes")}</label>
                  <input
                    type="text"
                    value={inv.notes}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, notes: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-input rounded-lg text-sm"
                    placeholder={t("partner.sales.new.lineNotesPlaceholder")}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setInvoices((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 text-muted-foreground/70 hover:text-destructive rounded-lg"
                  title={t("partner.sales.new.removeLineTitle")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full border border-transparent bg-primary px-5 py-2.5 text-[17px] font-normal text-primary-foreground hover:opacity-[0.88] disabled:opacity-50"
        >
          {saving ? t("common.saving") : t("partner.sales.new.createSale")}
        </button>
        <Link href={cancelHref} className="px-4 py-2 border border-border/60 rounded-lg text-sm font-medium text-foreground hover:bg-muted/40">
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
