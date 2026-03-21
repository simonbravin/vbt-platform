"use client";

import { useState, useEffect } from "react";
import { NewSaleClient } from "@/app/(dashboard)/sales/new/NewSaleClient";
import { useT } from "@/lib/i18n/context";

export function SuperadminNewSaleClient({ initialOrganizationId = "" }: { initialOrganizationId?: string }) {
  const t = useT();
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/saas/partners?limit=200")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        d?.partners &&
        setPartners(d.partners.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialOrganizationId) setOrganizationId(initialOrganizationId);
  }, [initialOrganizationId]);

  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <label className="block text-sm font-medium text-foreground mb-1">{t("admin.entities.partnerLabel")}</label>
        <select
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
        >
          <option value="">{t("admin.entities.selectPartner")}</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {!organizationId ? (
          <p className="text-sm text-muted-foreground mt-2">{t("superadmin.sales.new.selectPartnerFirst")}</p>
        ) : null}
      </div>

      {organizationId ? (
        <NewSaleClient
          key={organizationId}
          scopedOrganizationId={organizationId}
          backHref="/superadmin/sales"
          cancelHref="/superadmin/sales"
          successPath={(id) => `/superadmin/sales/${id}`}
        />
      ) : null}
    </div>
  );
}
