"use client";

import { useState, useEffect } from "react";
import { Globe, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/context";

export default function CountriesPage() {
  const t = useT();
  const [countries, setCountries] = useState<any[]>([]);
  const [newForm, setNewForm] = useState({ code: "", name: "" });
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    fetch("/api/countries").then(r => r.json()).then(d => setCountries(Array.isArray(d) ? d : []));
  };

  useEffect(() => { load(); }, []);

  const addCountry = async () => {
    if (!newForm.code || !newForm.name) return;
    setAdding(true);
    await fetch("/api/countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    setAdding(false);
    setNewForm({ code: "", name: "" });
    setShowAdd(false);
    load();
  };

  const toggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/countries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("admin.countries.title")}</h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> {t("admin.countries.add")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {countries.map((c) => (
          <div
            key={c.id}
            className={`surface-card p-4 ${c.isActive ? "" : "border-border/50 opacity-70"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.code} · {c.currency}</p>
                </div>
              </div>
              <button
                onClick={() => toggle(c.id, c.isActive)}
                className={`rounded-sm px-2 py-1 text-xs font-medium ${c.isActive ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}
              >
                {c.isActive ? t("admin.countries.active") : t("admin.countries.inactive")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="surface-modal m-4 w-full max-w-sm p-6">
            <h3 className="font-semibold text-lg mb-4">{t("admin.countries.modalTitle")}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t("admin.countries.code")}</label>
                <input
                  type="text"
                  maxLength={2}
                  value={newForm.code}
                  onChange={(e) => setNewForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder={t("admin.countries.codePlaceholder")}
                  className="input-native"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t("admin.countries.countryName")}</label>
                <input
                  type="text"
                  value={newForm.name}
                  onChange={(e) => setNewForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={t("admin.countries.namePlaceholder")}
                  className="input-native"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-sm border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted/40">
                {t("common.cancel")}
              </button>
              <button type="button" onClick={addCountry} disabled={adding} className="rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {adding ? t("admin.countries.adding") : t("common.add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
