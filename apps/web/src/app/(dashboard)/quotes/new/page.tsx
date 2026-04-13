"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

/**
 * Ruta histórica `/quotes/new`. Redirige a `/quotes/create` (borrador vía `/api/saas/quotes`).
 * El wizard por pasos fue retirado del código; enlaces del dashboard apuntan a `/quotes/create`.
 */
export default function NewQuotePage() {
  const t = useT();
  const router = useRouter();
  useEffect(() => {
    router.replace("/quotes/create");
  }, [router]);
  return (
    <div className="data-entry-page p-6 space-y-4">
      <p className="text-muted-foreground text-sm">
        {t("quotes.newQuoteTitle")} — redirecting to create draft…
      </p>
      <p className="text-sm">
        <Link href="/quotes/create" className="text-primary hover:underline">
          Go to Create Quote
        </Link>
      </p>
    </div>
  );
}
