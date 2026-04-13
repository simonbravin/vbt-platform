"use client";

import { useState, useEffect } from "react";
import { NewSaleClient } from "@/app/(dashboard)/sales/new/NewSaleClient";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";

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
    <div className="data-entry-page-wide">
      <div className="w-full max-w-md">
        <label className="block text-sm font-medium text-foreground mb-1">{t("admin.entities.partnerLabel")}</label>
        <FilterSelect
          value={organizationId}
          onValueChange={setOrganizationId}
          emptyOptionLabel={t("admin.entities.selectPartner")}
          options={partners.map((p) => ({ value: p.id, label: p.name }))}
          aria-label={t("admin.entities.partnerLabel")}
          triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
        />
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
