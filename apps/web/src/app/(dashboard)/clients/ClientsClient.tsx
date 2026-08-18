"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Building2, Search, Plus, Pencil, Mail, Phone } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FilterSelect } from "@/components/ui/filter-select";
import { ViewLayoutToggle } from "@/components/ui/view-layout-toggle";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { saasApiUserFacingMessage } from "@/lib/saas-api-error-message";

type Country = { id: string; name: string; code: string };
type Client = {
  id: string;
  name: string;
  legalName: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  countryCode?: string | null;
  country: { id: string; name: string; code: string } | null;
  _count: { projects: number; sales: number };
};

type SortKey = "name" | "projects" | "sales";

const SEARCH_DEBOUNCE_MS = 350;

function hydrateClients(rows: Client[], countries: Country[]): Client[] {
  return rows.map((c) => {
    const code = c.countryCode ?? c.country?.code ?? null;
    const co = code ? countries.find((x) => x.code === code || x.id === code) : undefined;
    return {
      ...c,
      country: c.country ?? co ?? (code ? { id: code, name: code, code } : null),
      _count: {
        projects: c._count?.projects ?? 0,
        sales: c._count?.sales ?? 0,
      },
    };
  });
}

async function readResponseJson(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

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
  const [clients, setClients] = useState<Client[]>(() => hydrateClients(initialClients, countries));
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const skipInitialFetch = useRef(true);

  const applyList = useCallback(
    (rows: Client[], nextTotal: number) => {
      setClients(hydrateClients(rows, countries));
      setTotal(nextTotal);
    },
    [countries]
  );

  const fetchList = useCallback(
    async (q: string, sort: SortKey, dir: "asc" | "desc", signal?: AbortSignal) => {
      const params = new URLSearchParams({ limit: "50", sort, dir });
      if (q) params.set("search", q);
      const res = await fetch(`/api/clients?${params}`, { signal });
      const data = (await readResponseJson(res)) as { clients?: Client[]; total?: number };
      if (!res.ok || !Array.isArray(data.clients)) {
        throw new Error("list_failed");
      }
      applyList(data.clients, typeof data.total === "number" ? data.total : 0);
    },
    [applyList]
  );

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const runSearch = useCallback(() => {
    setDebouncedSearch(search.trim());
  }, [search]);

  const handleSort = useCallback((key: string) => {
    if (key !== "name" && key !== "projects" && key !== "sales") return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" ? "asc" : "desc");
  }, [sortKey]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSearching(true);
    setSearchError(null);
    fetchList(debouncedSearch, sortKey, sortDir, ac.signal)
      .catch(() => {
        if (!ac.signal.aborted) setSearchError(t("clients.searchFailed"));
      })
      .finally(() => {
        if (!ac.signal.aborted) setSearching(false);
      });
    return () => ac.abort();
  }, [debouncedSearch, sortKey, sortDir, fetchList, t]);

  const refreshList = useCallback(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSearchError(null);
    fetchList(search.trim(), sortKey, sortDir, ac.signal).catch(() => {
      if (!ac.signal.aborted) setSearchError(t("clients.searchFailed"));
    });
  }, [fetchList, search, sortKey, sortDir, t]);

  const openNew = () => {
    setForm(emptyForm);
    setError("");
    setNewOpen(true);
  };

  const openEdit = (c: Client) => {
    setForm({
      name: c.name,
      legalName: c.legalName ?? "",
      taxId: c.taxId ?? "",
      address: c.address ?? "",
      city: c.city ?? "",
      countryId: c.country?.id ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      website: c.website ?? "",
      notes: c.notes ?? "",
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
    try {
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
      const data = await readResponseJson(res);
      if (res.ok) {
        setNewOpen(false);
        refreshList();
      } else {
        setError(saasApiUserFacingMessage(data, t, t("clients.failedToCreate")));
      }
    } catch {
      setError(t("clients.failedToCreate"));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editId || !form.name.trim()) {
      setError(t("clients.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
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
      const data = await readResponseJson(res);
      if (res.ok) {
        setEditId(null);
        refreshList();
      } else {
        setError(saasApiUserFacingMessage(data, t, t("clients.failedToUpdate")));
      }
    } catch {
      setError(t("clients.failedToUpdate"));
    } finally {
      setSaving(false);
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
          <FilterSelect
            value={form.countryId}
            onValueChange={(v) => setForm((f) => ({ ...f, countryId: v }))}
            emptyOptionLabel={t("clients.noneOption")}
            options={countries.map((co) => ({ value: co.id, label: co.name }))}
            aria-label={t("clients.country")}
            triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
          />
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
        <p className="text-destructive text-sm border border-destructive/25 rounded-lg px-2 py-1.5 bg-destructive/5" role="alert">
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
          {searching ? t("common.loading") : t("common.search")}
        </Button>
        <ViewLayoutToggle view={view} onViewChange={setView} />
      </div>

      {searchError && (
        <p className="text-destructive text-sm border border-destructive/25 rounded-lg px-2 py-1.5 bg-destructive/5" role="alert">
          {searchError}
        </p>
      )}

      {clients.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-background p-12 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/35" />
          {debouncedSearch ? (
            <p className="text-sm font-medium text-foreground">{t("clients.noSearchResults")}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">{t("clients.noClientsYet")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("clients.noClientsHint")}</p>
            </>
          )}
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <div
              key={c.id}
              className="flex flex-col rounded-lg border border-border/60 bg-card p-5 transition-colors hover:border-border"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
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
                {" · "}
                {c._count.sales} {c._count.sales === 1 ? t("clients.saleSingular") : t("clients.salePlural")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="list-table-wrap">
          <table className="list-table">
            <thead>
              <tr>
                <SortableTableHead
                  label={t("common.name")}
                  sortKey="name"
                  activeSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <th>{t("clients.legalName")}</th>
                <th>{t("clients.country")}</th>
                <th>{t("clients.tableContact")}</th>
                <SortableTableHead
                  label={t("projects.title")}
                  sortKey="projects"
                  activeSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="center"
                />
                <SortableTableHead
                  label={t("clients.tableSales")}
                  sortKey="sales"
                  activeSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="center"
                />
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground">{c.legalName ?? "—"}</td>
                  <td className="text-muted-foreground">{c.country?.name ?? "—"}</td>
                  <td className="text-muted-foreground">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="text-center">{c._count.projects}</td>
                  <td className="text-center">{c._count.sales}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
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
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border/60 bg-background p-6"
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
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border/60 bg-background p-6"
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
