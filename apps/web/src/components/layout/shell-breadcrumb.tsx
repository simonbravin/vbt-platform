"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useT } from "@/lib/i18n/context";

const PARTNER_SEGMENT_KEY: Record<string, string> = {
  dashboard: "nav.dashboard",
  clients: "nav.clients",
  engineering: "nav.engineering",
  projects: "nav.projects",
  quotes: "nav.quotes",
  sales: "nav.sales",
  inventory: "nav.inventory",
  documents: "nav.documents",
  training: "nav.training",
  reports: "nav.reports",
  settings: "nav.settings",
  profile: "nav.settings.profile",
  pending: "auth.pendingTitle",
};

const SUPERADMIN_SEGMENT_KEY: Record<string, string> = {
  dashboard: "nav.superadmin.dashboard",
  partners: "nav.superadmin.partners",
  engineering: "nav.superadmin.engineering",
  projects: "nav.superadmin.projects",
  quotes: "nav.superadmin.quotes",
  sales: "nav.superadmin.sales",
  admin: "nav.admin",
  documents: "nav.superadmin.documents",
  training: "nav.superadmin.training",
  quizzes: "nav.superadmin.quizzes",
  analytics: "nav.superadmin.analytics",
  reports: "nav.superadmin.reports",
  activity: "nav.superadmin.activity",
  settings: "nav.superadmin.settings",
  emails: "nav.superadmin.emailPreviews",
};

function partnerPageKey(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] ?? "dashboard";
  return PARTNER_SEGMENT_KEY[first] ?? "nav.dashboard";
}

function superadminPageKey(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "superadmin") return "nav.superadmin.dashboard";
  const rest = parts.slice(1);
  if (rest[0] === "admin" && rest[1] === "inventory") return "nav.superadmin.inventory";
  if (rest[0] === "training" && rest[1] === "certificates" && rest[2] === "verify") {
    return "nav.superadmin.certificateVerify";
  }
  if (rest[0] === "training" && rest[1] === "certificates") return "nav.superadmin.trainingCertificates";
  const seg = rest[0] ?? "dashboard";
  return SUPERADMIN_SEGMENT_KEY[seg] ?? "nav.superadmin.dashboard";
}

export function ShellBreadcrumb() {
  const pathname = usePathname() || "/";
  const t = useT();
  const isSuperadmin = pathname.startsWith("/superadmin");
  const homeHref = isSuperadmin ? "/superadmin/dashboard" : "/dashboard";
  const pageKey = isSuperadmin ? superadminPageKey(pathname) : partnerPageKey(pathname);

  return (
    <Breadcrumb aria-label={t("shell.breadcrumbNav")}>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden sm:inline-flex">
          <BreadcrumbLink asChild>
            <Link href={homeHref}>{t("topbar.title")}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden sm:inline-flex" />
        <BreadcrumbItem>
          <BreadcrumbPage>{t(pageKey)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
