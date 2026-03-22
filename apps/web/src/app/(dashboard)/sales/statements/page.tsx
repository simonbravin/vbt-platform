import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import { StatementsClient } from "./StatementsClient";
import { getServerT } from "@/lib/i18n/server";

export default async function StatementsPage() {
  try {
    await requireAuth();
  } catch (e) {
    if ((e as Error)?.message === "NEXT_REDIRECT") throw e;
    redirect("/login");
  }
  const { t } = await getServerT();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("partner.sales.page.statementsTitle")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("partner.sales.page.statementsSubtitle")}</p>
      </div>
      <StatementsClient />
    </div>
  );
}
