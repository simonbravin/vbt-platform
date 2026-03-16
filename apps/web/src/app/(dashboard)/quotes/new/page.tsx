"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

/**
 * Legacy step-by-step quote wizard. Deprecated: it posted to /api/quotes (501).
 * Redirect to /quotes/create to create a draft via /api/saas/quotes, then add items from the quote detail.
 */
export default function NewQuotePage() {
  const t = useT();
  const router = useRouter();
  useEffect(() => {
    router.replace("/quotes/create");
  }, [router]);
  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <p className="text-muted-foreground text-sm">
        {t("quotes.newQuoteTitle")} — redirecting to create draft…
      </p>
      <p className="text-sm">
        <Link href="/quotes/create" className="text-vbt-blue hover:underline">
          Go to Create Quote
        </Link>
      </p>
    </div>
  );
}
