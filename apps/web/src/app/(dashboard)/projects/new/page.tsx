"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { STATIC_COUNTRIES } from "@/lib/countries";
import { useT } from "@/lib/i18n/context";

type Country = { id: string; name: string; code: string };
type Client = { id: string; name: string; legalName?: string | null };

export default function NewProjectPage() {
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    legalName: "",
    countryId: "",
    email: "",
    phone: "",
  });
  const [savingClient, setSavingClient] = useState(false);
  const [newClientError, setNewClientError] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectName: "",
    clientId: "" as string,
    countryCode: "" as string,
    city: "",
    address: "",
    estimatedTotalAreaM2: "" as string,
    description: "",
  });

  useEffect(() => {
    fetch("/api/countries")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.countries ?? [];
        if (list.length > 0) {
          setCountries(list);
        } else {
          setCountries(STATIC_COUNTRIES.map((c) => ({ id: c.code, name: c.name, code: c.code })));
        }
      })
      .catch(() => setCountries(STATIC_COUNTRIES.map((c) => ({ id: c.code, name: c.name, code: c.code }))));
  }, []);

  useEffect(() => {
    fetch("/api/clients?limit=500")
      .then((r) => r.json())
      .then((data) => setClients(data.clients ?? []))
      .catch(() => setClients([]));
  }, []);

  const update = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val }));

  async function saveNewClient() {
    if (!newClientForm.name.trim()) return;
    setSavingClient(true);
    setNewClientError(null);
    try {
      const countryCode = newClientForm.countryId
        ? (countries.find((c) => c.id === newClientForm.countryId)?.code ?? newClientForm.countryId)
        : undefined;
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientForm.name.trim(),
          legalName: newClientForm.legalName.trim() || undefined,
          countryCode: countryCode || undefined,
          email: newClientForm.email.trim() || undefined,
          phone: newClientForm.phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setClients((prev) => [...prev, data]);
        setForm((p) => ({ ...p, clientId: data.id }));
        setNewClientOpen(false);
        setNewClientForm({ name: "", legalName: "", countryId: "", email: "", phone: "" });
      } else {
        setNewClientError(data.error ?? t("auth.errorUnexpected"));
      }
    } catch {
      setNewClientError(t("auth.errorUnexpected"));
    } finally {
      setSavingClient(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectName.trim()) { setError(t("projects.projectNameRequired")); return; }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        projectName: form.projectName.trim(),
        clientId: form.clientId || null,
        countryCode: form.countryCode || null,
        city: form.city.trim() || undefined,
        address: form.address.trim() || undefined,
        estimatedTotalAreaM2: form.estimatedTotalAreaM2 ? parseFloat(form.estimatedTotalAreaM2) : null,
        description: form.description.trim() || undefined,
      };
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("projects.failedCreate")); return; }
      router.push(`/projects/${data.id}`);
    } catch { setError(t("auth.errorUnexpected")); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("projects.newProjectTitle")}</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("projects.projectNameLabel")}</label>
          <input
            type="text"
            value={form.projectName}
            onChange={(e) => update("projectName", e.target.value)}
            placeholder={t("projects.projectNamePlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("projects.client")}</label>
          <div className="flex gap-2">
            <select
              value={form.clientId}
              onChange={(e) => update("clientId", e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue bg-white"
            >
              <option value="">{t("projects.noneOption")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNewClientOpen(true)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> {t("clients.newClient")}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.country")}</label>
          <select
            value={form.countryCode}
            onChange={(e) => update("countryCode", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue bg-white"
          >
            <option value="">{t("projects.selectCountry")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.code ?? ""}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("projects.city")}</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder={t("projects.city")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("projects.address")}</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder={t("projects.addressPlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("projects.areaM2")}</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.estimatedTotalAreaM2}
            onChange={(e) => update("estimatedTotalAreaM2", e.target.value)}
            placeholder={t("projects.areaPlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("projects.description")}</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder={t("projects.descriptionPlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/projects" className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            {t("common.cancel")}
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
          >
            {loading ? t("projects.creating") : t("projects.createProject")}
          </button>
        </div>
      </form>

      {newClientOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
            onClick={() => setNewClientOpen(false)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-900">{t("projects.newClientModalTitle")}</h2>
              {newClientError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{newClientError}</div>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-1">{t("common.name")} *</label>
                <input
                  value={newClientForm.name}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                  placeholder={t("projects.companyNamePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{t("projects.legalName")}</label>
                <input
                  value={newClientForm.legalName}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, legalName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{t("common.country")}</label>
                <select
                  value={newClientForm.countryId}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, countryId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                >
                  <option value="">{t("projects.noneOption")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{t("auth.email")}</label>
                <input
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{t("common.phone")}</label>
                <input
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setNewClientOpen(false)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={saveNewClient}
                  disabled={savingClient || !newClientForm.name.trim()}
                  className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
                >
                  {savingClient ? t("common.saving") : t("projects.createClient")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
