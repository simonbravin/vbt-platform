"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Country = { id: string; name: string; code: string };
type Client = {
  id: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  countryCode?: string | null;
  countryId?: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes?: string | null;
  country?: { id: string; name: string; code: string } | null;
};

export function ClientDetailActions({
  client,
  countries,
}: {
  client: Client;
  countries: Country[];
}) {
  const t = useT();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: client.name,
    legalName: client.legalName ?? "",
    taxId: client.taxId ?? "",
    address: client.address ?? "",
    city: client.city ?? "",
    countryId: client.country?.id ?? "",
    countryCode: client.countryCode ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    website: client.website ?? "",
    notes: client.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openEdit = () => {
    setForm({
      name: client.name,
      legalName: client.legalName ?? "",
      taxId: client.taxId ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      countryId: client.country?.id ?? "",
      countryCode: client.countryCode ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      website: client.website ?? "",
      notes: client.notes ?? "",
    });
    setError("");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!form.name.trim()) {
      setError(t("clients.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        legalName: form.legalName?.trim() || undefined,
        taxId: form.taxId?.trim() || undefined,
        address: form.address?.trim() || undefined,
        city: form.city?.trim() || undefined,
        countryId: form.countryId || undefined,
        countryCode: form.countryCode?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
        website: form.website?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setEditOpen(false);
      router.refresh();
    } else {
      setError(data.error ?? t("clients.failedToUpdate"));
    }
  };

  const modalForm = (
    <div className="space-y-3 text-sm">
      <div>
        <label className="block text-gray-600 mb-1">{t("clients.nameLabel")}</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-1">{t("clients.legalName")}</label>
        <input
          value={form.legalName}
          onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-600 mb-1">{t("clients.taxId")}</label>
          <input
            value={form.taxId}
            onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          />
        </div>
        <div>
          <label className="block text-gray-600 mb-1">{t("clients.country")}</label>
          <select
            value={form.countryId}
            onChange={(e) => setForm((f) => ({ ...f, countryId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          >
            <option value="">{t("clients.noneOption")}</option>
            {countries.map((co) => (
              <option key={co.id} value={co.id}>{co.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-gray-600 mb-1">{t("clients.address")}</label>
        <input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-1">{t("clients.city")}</label>
        <input
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-600 mb-1">{t("clients.phone")}</label>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          />
        </div>
        <div>
          <label className="block text-gray-600 mb-1">{t("clients.email")}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
          />
        </div>
      </div>
      <div>
        <label className="block text-gray-600 mb-1">{t("clients.website")}</label>
        <input
          value={form.website}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-1">{t("clients.notes")}</label>
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
    <>
      <button
        type="button"
        onClick={openEdit}
        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
      >
        <Pencil className="w-4 h-4" /> {t("common.edit")}
      </button>
      {editOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
            onClick={() => setEditOpen(false)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit client</h2>
              {modalForm}
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
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
    </>
  );
}
