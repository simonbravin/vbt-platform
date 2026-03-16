"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy admin inventory page. Deprecated in favor of /inventory (SaaS inventory).
 * Redirects to the main Inventory page which uses /api/saas/warehouses and /api/saas/inventory/*.
 */
export default function AdminInventoryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/inventory");
  }, [router]);
  return (
    <div className="p-8 text-center text-muted-foreground text-sm">
      Redirecting to Inventory…
    </div>
  );
}
