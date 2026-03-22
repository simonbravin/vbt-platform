"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type TaxBase = "CIF" | "FOB" | "BASE_IMPONIBLE" | "FIXED_PER_CONTAINER" | "FIXED_TOTAL";

interface TaxRule {
  order: number;
  label: string;
  base: TaxBase;
  ratePct?: number;
  fixedAmount?: number;
  note?: string;
}

const IS_PCT: Record<TaxBase, boolean> = {
  CIF: true,
  FOB: true,
  BASE_IMPONIBLE: true,
  FIXED_PER_CONTAINER: false,
  FIXED_TOTAL: false,
};

export default function TaxesPage() {
  const t = useT();
  const BASE_LABELS: Record<TaxBase, string> = useMemo(
    () => ({
      CIF: t("admin.taxes.baseCif"),
      FOB: t("admin.taxes.baseFob"),
      BASE_IMPONIBLE: t("admin.taxes.baseBaseImponible"),
      FIXED_PER_CONTAINER: t("admin.taxes.baseFixedPerContainer"),
      FIXED_TOTAL: t("admin.taxes.baseFixedTotal"),
    }),
    [t]
  );
  const [taxSets, setTaxSets] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editSet, setEditSet] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", countryId: "", rules: [] as TaxRule[] });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/tax-rules").then(r => r.json()).then(d => setTaxSets(Array.isArray(d) ? d : []));
  };

  useEffect(() => {
    load();
    fetch("/api/countries").then(r => r.json()).then(d => setCountries(Array.isArray(d) ? d : []));
  }, []);

  const openAdd = () => {
    setSaveError(null);
    setForm({ name: "", countryId: "", rules: [] });
    setEditSet(null);
    setShowAdd(true);
  };

  const openEdit = (ts: any) => {
    setForm({ name: ts.name, countryId: ts.countryId ?? "", rules: ts.rules ?? [] });
    setEditSet(ts);
    setShowAdd(true);
  };

  const addRule = () => {
    setForm(p => ({
      ...p,
      rules: [...p.rules, { order: p.rules.length + 1, label: "", base: "CIF" as TaxBase, ratePct: 0 }],
    }));
  };

  const updateRule = (i: number, field: keyof TaxRule, value: any) => {
    setForm(p => {
      const rules = [...p.rules];
      (rules[i] as any)[field] = value;
      return { ...p, rules };
    });
  };

  const removeRule = (i: number) => {
    setForm(p => ({
      ...p,
      rules: p.rules
        .filter((_, idx) => idx !== i)
        .map((r, idx) => ({ ...r, order: idx + 1 })),
    }));
  };

  const save = async () => {
    if (!form.name || !form.countryId) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      ...form,
      rules: form.rules.map((r, i) => ({ ...r, order: i + 1 })),
    };
    try {
      const res = editSet
        ? await fetch(`/api/tax-rules/${editSet.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/tax-rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data?.error ?? "Failed to save");
        return;
      }
      setShowAdd(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("admin.taxes.title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t("admin.taxes.subtitle")}</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900"
        >
          <Plus className="w-4 h-4" /> {t("admin.taxes.add")}
        </button>
      </div>

      <div className="space-y-3">
        {taxSets.length === 0 && (
          <p className="text-gray-400 text-center py-8">{t("admin.taxes.noRuleSetsYet")}</p>
        )}
        {taxSets.map((ts) => (
          <div key={ts.id} className="surface-card-overflow">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(expanded === ts.id ? null : ts.id)}
            >
              <div>
                <p className="font-semibold text-gray-800">{ts.name}</p>
                <p className="text-gray-400 text-sm">
                  {ts.country?.name ?? t("admin.taxes.noCountry")} · {(ts.rules ?? []).length} {t("admin.taxes.rules")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(ts); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {expanded === ts.id
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>
            {expanded === ts.id && (
              <div className="border-t border-gray-100 px-4 pb-4">
                <table className="w-full text-sm mt-3">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase">
                      <th className="pb-2 w-6">#</th>
                      <th className="pb-2 pr-4">{t("admin.taxes.label")}</th>
                      <th className="pb-2 pr-4">{t("admin.taxes.base")}</th>
                      <th className="pb-2 text-right">{t("admin.taxes.amount")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(ts.rules ?? []).map((rule: TaxRule, i: number) => (
                      <tr key={i}>
                        <td className="py-2 text-gray-300 text-xs">{rule.order}</td>
                        <td className="py-2 pr-4 text-gray-800">{rule.label}</td>
                        <td className="py-2 pr-4 text-gray-500 text-xs">{BASE_LABELS[rule.base] ?? rule.base}</td>
                        <td className="py-2 text-right font-medium">
                          {IS_PCT[rule.base]
                            ? `${rule.ratePct ?? 0}%`
                            : `$${rule.fixedAmount ?? 0}`}
                        </td>
                      </tr>
                    ))}
                    {(ts.rules ?? []).length === 0 && (
                      <tr><td colSpan={4} className="py-3 text-gray-400">{t("admin.taxes.noRules")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="surface-modal flex max-h-[90vh] w-full max-w-3xl flex-col">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-lg">{editSet ? t("admin.taxes.editRuleSetTitle") : t("admin.taxes.addRuleSetTitle")}</h3>
              {saveError && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {saveError}
                </div>
              )}
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.taxes.nameLabel")}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder={t("admin.taxes.namePlaceholder")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.taxes.countryLabel")}</label>
                  <select
                    value={form.countryId}
                    onChange={(e) => setForm(p => ({ ...p, countryId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                  >
                    <option value="">{t("admin.taxes.selectOption")}</option>
                    {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">{t("admin.taxes.rulesAppliedInOrder")}</label>
                  <button
                    onClick={addRule}
                    className="text-xs text-vbt-blue hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> {t("admin.taxes.addRule")}
                  </button>
                </div>
                <div className="space-y-2">
                  {form.rules.map((rule, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-xs text-gray-300 mt-2 w-4">{i + 1}</span>
                      <input
                        type="text"
                        value={rule.label}
                        onChange={(e) => updateRule(i, "label", e.target.value)}
                        placeholder={t("admin.taxes.labelPlaceholder")}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-vbt-blue"
                      />
                      <select
                        value={rule.base}
                        onChange={(e) => updateRule(i, "base", e.target.value as TaxBase)}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-vbt-blue"
                      >
                        {(Object.keys(BASE_LABELS) as TaxBase[]).map(b => (
                          <option key={b} value={b}>{BASE_LABELS[b]}</option>
                        ))}
                      </select>
                      {IS_PCT[rule.base] ? (
                        <div className="relative w-20">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rule.ratePct ?? 0}
                            onChange={(e) => updateRule(i, "ratePct", parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 pr-5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-vbt-blue"
                          />
                          <span className="absolute right-2 top-1.5 text-gray-400 text-xs">%</span>
                        </div>
                      ) : (
                        <div className="relative w-20">
                          <span className="absolute left-2 top-1.5 text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={rule.fixedAmount ?? 0}
                            onChange={(e) => updateRule(i, "fixedAmount", parseFloat(e.target.value) || 0)}
                            className="w-full pl-4 pr-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-vbt-blue"
                          />
                        </div>
                      )}
                      <button onClick={() => removeRule(i)} className="p-1.5 text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {form.rules.length === 0 && (
                    <p className="text-gray-400 text-sm">{t("admin.taxes.noRulesYetClickAdd")}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">{t("common.cancel")}</button>
              <button
                onClick={save}
                disabled={saving || !form.name || !form.countryId}
                className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
