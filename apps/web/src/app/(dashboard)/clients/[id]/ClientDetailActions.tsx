"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const nativeSelectClass =
  "flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
  const initialCountryId = client.country?.id ?? (client.countryCode && countries.find((c) => c.code === client.countryCode)?.id) ?? "";
  const [form, setForm] = useState({
    name: client.name,
    legalName: client.legalName ?? "",
    taxId: client.taxId ?? "",
    address: client.address ?? "",
    city: client.city ?? "",
    countryId: initialCountryId,
    countryCode: client.countryCode ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    website: client.website ?? "",
    notes: client.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openEdit = () => {
    const countryId = client.country?.id ?? (client.countryCode && countries.find((c) => c.code === client.countryCode)?.id) ?? "";
    setForm({
      name: client.name,
      legalName: client.legalName ?? "",
      taxId: client.taxId ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      countryId,
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
    const countryCode = form.countryId ? (countries.find((c) => c.id === form.countryId)?.code ?? form.countryId) : null;
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        legalName: form.legalName?.trim() || undefined,
        taxId: form.taxId?.trim() || undefined,
        address: form.address?.trim() || undefined,
        city: form.city?.trim() || undefined,
        countryCode: countryCode ?? undefined,
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
        <label className="mb-1 block text-xs text-muted-foreground">{t("clients.nameLabel")}</label>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">{t("clients.legalName")}</label>
        <Input value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("clients.taxId")}</label>
          <Input value={form.taxId} onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("clients.country")}</label>
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
        <label className="mb-1 block text-xs text-muted-foreground">{t("clients.address")}</label>
        <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">{t("clients.city")}</label>
        <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("clients.phone")}</label>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("clients.email")}</label>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">{t("clients.website")}</label>
        <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">{t("clients.notes")}</label>
        <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="min-h-[60px]" />
      </div>
      {error && (
        <p className="rounded-sm border border-destructive/25 bg-destructive/5 px-2 py-1.5 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <>
      <Button type="button" variant="outline" onClick={openEdit} className="gap-2 border-border/60">
        <Pencil className="h-4 w-4" /> {t("common.edit")}
      </Button>
      {editOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4"
            onClick={() => setEditOpen(false)}
          >
            <div
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-sm border border-border/60 bg-background p-6 ring-1 ring-border/60"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">Edit client</h2>
              {modalForm}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="border-border/60">
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
    </>
  );
}
