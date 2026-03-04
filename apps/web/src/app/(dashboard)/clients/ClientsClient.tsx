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
  Globe,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

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
  const [view, setView] = useState<"cards" | "table">("cards");
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
      .then((r) => r.json())
      .then((data) => setStats(data))
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
      .then((r) => r.json())
      .then((data) => {
        setClients(data.clients ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setSearching(false));
  }, [search.trim(), initialClients, initialTotal]);

  const refreshList = useCallback(() => {
    fetch(`/api/clients?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setClients(data.clients ?? []);
        setTotal(data.total ?? 0);
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
      setError("Name is required");
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
        countryId: form.countryId || undefined,
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
      setError(data.error ?? "Failed to create client");
    }
  };

  const saveEdit = async () => {
    if (!editId || !form.name.trim()) {
      setError("Name is required");
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
        countryId: form.countryId || null,
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
      setError(data.error ?? "Failed to update client");
    }
  };

  const modalForm = (
    <div className="space-y-3 text-sm">
      <div>
        <label className="block text-gray-600 mb-1">Name *</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
          placeholder="Company name"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-1">Legal name</label>
        <input
          value={form.legalName}
          onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          placeholder="Legal name"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-600 mb-1">Tax ID</label>
          <input
            value={form.taxId}
            onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          />
        </div>
        <div>
          <label className="block text-gray-600 mb-1">Country</label>
          <select
            value={form.countryId}
            onChange={(e) => setForm((f) => ({ ...f, countryId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          >
            <option value="">— None —</option>
            {countries.map((co) => (
              <option key={co.id} value={co.id}>{co.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-gray-600 mb-1">Address</label>
        <input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          placeholder="Street, number"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-1">City</label>
        <input
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-600 mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          />
        </div>
        <div>
          <label className="block text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          />
        </div>
      </div>
      <div>
        <label className="block text-gray-600 mb-1">Website</label>
        <input
          value={form.website}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          placeholder="https://"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue min-h-[60px]"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("clients.title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} {t("clients.clientsCount")}</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900"
        >
          <Plus className="w-4 h-4" /> {t("clients.newClient")}
        </button>
      </div>

      {/* KPI cards */}
      {stats && (stats.topByProjects.length > 0 || stats.topBySold.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">{t("clients.kpiTopByProjects")}</h3>
            <ul className="space-y-1 text-sm">
              {stats.topByProjects.slice(0, 5).map((s) => (
                <li key={s.clientId} className="flex justify-between">
                  <Link href={`/clients/${s.clientId}`} className="text-vbt-blue hover:underline truncate mr-2">
                    {s.clientName}
                  </Link>
                  <span className="font-medium text-gray-700">{s.projectCount}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">{t("clients.kpiTopBySold")}</h3>
            <ul className="space-y-1 text-sm">
              {stats.topBySold.slice(0, 5).map((s) => (
                <li key={s.clientId} className="flex justify-between gap-2">
                  <span className="text-gray-700 truncate">{s.clientName ?? "—"}</span>
                  <span className="font-medium text-gray-900 whitespace-nowrap">{formatCurrency(s.totalSold)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t("clients.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>
        <button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
        >
          {searching ? "..." : t("common.search")}
        </button>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setView("cards")}
            title="Card view"
            className={`p-2 transition-colors ${view === "cards" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("table")}
            title="Table view"
            className={`p-2 transition-colors ${view === "table" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No clients yet</p>
          <p className="text-gray-400 text-sm mt-1">Create a client from the button above or when creating a project.</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  className="p-1.5 text-gray-400 hover:text-vbt-blue rounded"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              <Link href={`/clients/${c.id}`} className="font-semibold text-gray-800 hover:text-vbt-blue">
                {c.name}
              </Link>
              {c.legalName && c.legalName !== c.name && (
                <p className="text-xs text-gray-500 mt-0.5">{c.legalName}</p>
              )}
              {c.country && <p className="text-sm text-gray-500 mt-1">{c.country.name}</p>}
              <div className="mt-2 space-y-0.5 text-sm text-gray-500">
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
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                {c._count.projects} project{c._count.projects !== 1 ? "s" : ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Legal name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Country</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contact</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Projects</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-vbt-blue hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.legalName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.country?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">{c._count.projects}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="p-1.5 text-gray-400 hover:text-vbt-blue rounded"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
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
          <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setNewOpen(false)}>
            <div
              className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">New client</h2>
              {modalForm}
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setNewOpen(false)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={saveNew}
                  disabled={saving}
                  className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
                >
                  {saving ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Edit client modal */}
      {editId &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setEditId(null)}>
            <div
              className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit client</h2>
              {modalForm}
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setEditId(null)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
                >
                  {saving ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
