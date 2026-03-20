import { requireAuth } from "@/lib/utils";
import { NewSaleClient } from "./NewSaleClient";
import { getServerT } from "@/lib/i18n/server";

export default async function NewSalePage() {
  await requireAuth();
  const { t } = await getServerT();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("partner.sales.page.newTitle")}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{t("partner.sales.page.newSubtitle")}</p>
      </div>
      <NewSaleClient />
    </div>
  );
}
