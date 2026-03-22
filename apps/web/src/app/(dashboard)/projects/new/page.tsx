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
      const res = await fetch("/api/saas/projects", {
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
        <Link href="/projects" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("projects.newProjectTitle")}</h1>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-sm border border-border/60 bg-card p-6 ring-1 ring-border/40">
        {error && (
          <div className="rounded-sm border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("projects.projectNameLabel")}</label>
          <input
            type="text"
            value={form.projectName}
            onChange={(e) => update("projectName", e.target.value)}
            placeholder={t("projects.projectNamePlaceholder")}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("projects.client")}</label>
          <div className="flex gap-2">
            <select
              value={form.clientId}
              onChange={(e) => update("clientId", e.target.value)}
              className="flex-1 rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">{t("projects.noneOption")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNewClientOpen(true)}
              className="inline-flex items-center gap-1 rounded-sm border border-border/60 px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              <Plus className="w-4 h-4" /> {t("clients.newClient")}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("common.country")}</label>
          <select
            value={form.countryCode}
            onChange={(e) => update("countryCode", e.target.value)}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">{t("projects.selectCountry")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.code ?? ""}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("projects.city")}</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder={t("projects.city")}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("projects.address")}</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder={t("projects.addressPlaceholder")}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("projects.areaM2")}</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.estimatedTotalAreaM2}
            onChange={(e) => update("estimatedTotalAreaM2", e.target.value)}
            placeholder={t("projects.areaPlaceholder")}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("projects.description")}</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder={t("projects.descriptionPlaceholder")}
            className="w-full resize-none rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/projects" className="rounded-sm border border-border/60 px-4 py-2 text-sm text-foreground hover:bg-muted">
            {t("common.cancel")}
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-sm border border-primary/20 bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("projects.creating") : t("projects.createProject")}
          </button>
        </div>
      </form>

      {newClientOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4"
            onClick={() => setNewClientOpen(false)}
          >
            <div
              className="w-full max-w-md space-y-3 rounded-sm border border-border/60 bg-background p-6 ring-1 ring-border/60"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("projects.newClientModalTitle")}</h2>
              {newClientError && (
                <div className="rounded-sm border border-destructive/25 bg-destructive/5 p-2 text-sm text-destructive">{newClientError}</div>
              )}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("common.name")} *</label>
                <input
                  value={newClientForm.name}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder={t("projects.companyNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("projects.legalName")}</label>
                <input
                  value={newClientForm.legalName}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, legalName: e.target.value }))}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("common.country")}</label>
                <select
                  value={newClientForm.countryId}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, countryId: e.target.value }))}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t("projects.noneOption")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("auth.email")}</label>
                <input
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("common.phone")}</label>
                <input
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewClientOpen(false)}
                  className="rounded-sm border border-border/60 px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={saveNewClient}
                  disabled={savingClient || !newClientForm.name.trim()}
                  className="rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
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
