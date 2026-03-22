"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  Building2,
  LayoutGrid,
  List,
  Search,
  Plus,
  Pencil,
  Mail,
  Phone,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Country = { id: string; name: string; code: string };
type Client = {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: { id: string; name: string; code: string } | null;
  _count: { projects: number };
};

type Stats = {
  topByProjects: { clientId: string; clientName: string; projectCount: number }[];
  topBySold: { clientId: string; clientName: string | null; totalSold: number }[];
};

const SEARCH_DEBOUNCE_MS = 350;

const nativeSelectClass =
  "flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const emptyForm = {
  name: "",
  legalName: "",
  taxId: "",
  address: "",
  city: "",
  countryId: "",
  phone: "",
  email: "",
  website: "",
  notes: "",
};

export function ClientsClient({
  initialClients,
  initialTotal,
  countries,
}: {
  initialClients: Client[];
  initialTotal: number;
  countries: Country[];
}) {
  const t = useT();
  const [view, setView] = useState<"cards" | "table">("table");
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchStats = useCallback(() => {
    fetch("/api/clients/stats?limit=5")
      .then(async (r) => {
        if (!r.ok) return;
        try {
          const text = await r.text();
          const data = text ? JSON.parse(text) : null;
          if (data && (data.topByProjects != null || data.topBySold != null)) setStats(data);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const runSearch = useCallback(() => {
    const q = search.trim();
    if (!q) {
      setClients(initialClients);
      setTotal(initialTotal);
      return;
    }
    setSearching(true);
    fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=50`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const data = text ? JSON.parse(text) : {};
          if (r.ok && Array.isArray(data.clients)) {
            setClients(data.clients);
            setTotal(typeof data.total === "number" ? data.total : 0);
          }
        } catch {
          // ignore
        }
      })
      .finally(() => setSearching(false));
  }, [search.trim(), initialClients, initialTotal]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!search.trim()) {
        setClients(initialClients);
        setTotal(initialTotal);
        return;
      }
      setSearching(true);
      fetch(`/api/clients?search=${encodeURIComponent(search.trim())}&limit=50`)
        .then(async (r) => {
          try {
            const text = await r.text();
            const data = text ? JSON.parse(text) : {};
            if (r.ok && Array.isArray(data.clients)) {
              setClients(data.clients);
              setTotal(typeof data.total === "number" ? data.total : 0);
            }
          } catch {
            // ignore
          }
        })
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, initialClients, initialTotal]);

  const refreshList = useCallback(() => {
    fetch(`/api/clients?limit=50`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const data = text ? JSON.parse(text) : {};
          if (r.ok && Array.isArray(data.clients)) {
            setClients(data.clients);
            setTotal(typeof data.total === "number" ? data.total : 0);
          }
        } catch {
          // ignore
        }
      });
    fetchStats();
  }, [fetchStats]);

  const openNew = () => {
    setForm(emptyForm);
    setError("");
    setNewOpen(true);
  };

  const openEdit = (c: Client) => {
    setForm({
      name: c.name,
      legalName: c.legalName ?? "",
      taxId: (c as any).taxId ?? "",
      address: (c as any).address ?? "",
      city: (c as any).city ?? "",
      countryId: c.country?.id ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      website: c.website ?? "",
      notes: (c as any).notes ?? "",
    });
    setEditId(c.id);
    setError("");
  };

  const saveNew = async () => {
    if (!form.name.trim()) {
      setError(t("clients.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        countryCode: form.countryId ? (countries.find((c) => c.id === form.countryId)?.code ?? form.countryId) : undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setNewOpen(false);
      refreshList();
    } else {
      setError(data.error ?? t("clients.failedToCreate"));
    }
  };

  const saveEdit = async () => {
    if (!editId || !form.name.trim()) {
      setError(t("clients.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/clients/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        countryCode: form.countryId ? (countries.find((c) => c.id === form.countryId)?.code ?? form.countryId) : null,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setEditId(null);
      refreshList();
    } else {
      setError(data.error ?? t("clients.failedToUpdate"));
    }
  };

  const modalForm = (
    <div className="space-y-3 text-sm">
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.nameLabel")}</label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={t("clients.companyNamePlaceholder")}
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.legalName")}</label>
        <Input
          value={form.legalName}
          onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
          placeholder={t("clients.legalNamePlaceholder")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.taxId")}</label>
          <Input value={form.taxId} onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.country")}</label>
          <select
            value={form.countryId}
            onChange={(e) => setForm((f) => ({ ...f, countryId: e.target.value }))}
            className={nativeSelectClass}
          >
            <option value="">{t("clients.noneOption")}</option>
            {countries.map((co) => (
              <option key={co.id} value={co.id}>{co.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.address")}</label>
        <Input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder={t("clients.addressPlaceholder")}
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.city")}</label>
        <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.phone")}</label>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.email")}</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.website")}</label>
        <Input
          value={form.website}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          placeholder={t("clients.websitePlaceholder")}
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">{t("clients.notes")}</label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="min-h-[60px]"
        />
      </div>
      {error && (
        <p className="text-destructive text-sm border border-destructive/25 rounded-sm px-2 py-1.5 bg-destructive/5" role="alert">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("clients.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} {t("clients.clientsCount")}</p>
        </div>
        <Button type="button" onClick={openNew} className="gap-2 border border-primary/20">
          <Plus className="w-4 h-4" /> {t("clients.newClient")}
        </Button>
      </div>

      {/* KPI cards */}
      {stats && (stats.topByProjects.length > 0 || stats.topBySold.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-sm border border-border/60 bg-card p-4 ring-1 ring-border/40">
            <h3 className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("clients.kpiTopByProjects")}</h3>
            <ul className="space-y-1 text-sm">
              {stats.topByProjects.slice(0, 5).map((s) => (
                <li key={s.clientId} className="flex justify-between">
                  <Link href={`/clients/${s.clientId}`} className="text-primary hover:underline truncate mr-2">
                    {s.clientName}
                  </Link>
                  <span className="font-medium text-foreground">{s.projectCount}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-sm border border-border/60 bg-card p-4 ring-1 ring-border/40">
            <h3 className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("clients.kpiTopBySold")}</h3>
            <ul className="space-y-1 text-sm">
              {stats.topBySold.slice(0, 5).map((s) => (
                <li key={s.clientId} className="flex justify-between gap-2">
                  <span className="text-foreground truncate">{s.clientName ?? "—"}</span>
                  <span className="font-medium text-foreground whitespace-nowrap">{formatCurrency(s.totalSold)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t("clients.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="pl-9"
          />
        </div>
        <Button type="button" onClick={runSearch} disabled={searching} className="border border-primary/20 shrink-0">
          {searching ? "…" : t("common.search")}
        </Button>
        <div className="flex shrink-0 overflow-hidden rounded-sm border border-border/60 ring-1 ring-border/40">
          <button
            type="button"
            onClick={() => setView("cards")}
            title={t("clients.cardView")}
            className={`p-2 transition-colors ${view === "cards" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            title={t("clients.tableView")}
            className={`border-l border-border/60 p-2 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-sm border border-border/60 bg-background p-12 text-center ring-1 ring-border/40">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/35" />
          <p className="text-sm font-medium text-foreground">{t("clients.noClientsYet")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("clients.noClientsHint")}</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <div
              key={c.id}
              className="flex flex-col rounded-sm border border-border/60 bg-card p-5 ring-1 ring-border/40 transition-colors hover:border-border"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border/60 bg-muted/30">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                  title={t("clients.edit")}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <Link href={`/clients/${c.id}`} className="font-semibold text-foreground hover:text-primary">
                {c.name}
              </Link>
              {c.legalName && c.legalName !== c.name && (
                <p className="text-xs text-muted-foreground mt-0.5">{c.legalName}</p>
              )}
              {c.country && <p className="text-sm text-muted-foreground mt-1">{c.country.name}</p>}
              <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                {c.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" /> {c.email}
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {c.phone}
                  </div>
                )}
              </div>
              <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                {c._count.projects}{" "}
                {c._count.projects === 1 ? t("clients.projectSingular") : t("clients.projectPlural")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border/60 bg-card ring-1 ring-border/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("common.name")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("clients.legalName")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("clients.country")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("clients.tableContact")}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("projects.title")}</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.legalName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.country?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">{c._count.projects}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                      title={t("clients.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New client modal */}
      {newOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4"
            onClick={() => setNewOpen(false)}
          >
            <div
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-sm border border-border/60 bg-background p-6 ring-1 ring-border/60"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{t("clients.newClient")}</h2>
              {modalForm}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setNewOpen(false)} className="border-border/60">
                  {t("common.cancel")}
                </Button>
                <Button type="button" onClick={saveNew} disabled={saving} className="border border-primary/20">
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Edit client modal */}
      {editId &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4"
            onClick={() => setEditId(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-sm border border-border/60 bg-background p-6 ring-1 ring-border/60"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{t("clients.editClientTitle")}</h2>
              {modalForm}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditId(null)} className="border-border/60">
                  {t("common.cancel")}
                </Button>
                <Button type="button" onClick={saveEdit} disabled={saving} className="border border-primary/20">
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
