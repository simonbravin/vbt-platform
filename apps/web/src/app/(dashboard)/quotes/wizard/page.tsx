"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useT } from "@/lib/i18n/context";

function WizardLoading() {
  const t = useT();
  return (
    <div className="data-entry-page p-6">
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    </div>
  );
}

const QuoteWizard = dynamic(
  () => import("@/components/quotes/QuoteWizard").then((m) => m.QuoteWizard),
  { ssr: false, loading: () => <WizardLoading /> }
);

export default function QuoteWizardPage() {
  return (
    <Suspense fallback={<WizardLoading />}>
      <QuoteWizard />
    </Suspense>
  );
}
