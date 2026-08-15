import { redirect } from "next/navigation";

/** Legacy URL: Global Reports now lives as a tab on the insights hub. */
export default function SuperadminReportsRedirectPage() {
  redirect("/superadmin/analytics?tab=reports");
}
