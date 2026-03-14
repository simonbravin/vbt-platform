"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, User, Bell, Building2, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

interface TopBarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
  };
  /** When true, show context switcher (Platform vs Partner). Only set in superadmin layout. */
  showContextSwitcher?: boolean;
  /** Current organization name (partner context). Shown next to title when set. */
  activeOrgName?: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  SALES: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-600",
};

type PartnerOption = { id: string; name: string };

export function TopBar({ user, showContextSwitcher, activeOrgName }: TopBarProps) {
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!showContextSwitcher) return;
    let cancelled = false;
    fetch("/api/saas/partners?limit=100")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.partners) {
          setPartners(data.partners.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showContextSwitcher]);

  const setActiveOrg = async (organizationId: string | null) => {
    setSwitching(true);
    try {
      const res = await fetch("/api/saas/set-active-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (res.ok) {
        setSwitcherOpen(false);
        router.push(organizationId ? "/dashboard" : "/superadmin/dashboard");
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="h-14 bg-vbt-blue border-b border-white/10 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-white">{t("topbar.title")}</h1>
        <span className="text-white/40">|</span>
        {showContextSwitcher ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen((o) => !o)}
              disabled={switching}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/90 hover:bg-white/10 border border-white/20"
            >
              <Building2 className="h-4 w-4" />
              <span>View as</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {switcherOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setSwitcherOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] rounded-lg border border-white/20 bg-white shadow-lg py-1 text-left">
                  <button
                    type="button"
                    onClick={() => setActiveOrg(null)}
                    className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                  >
                    Platform (all)
                  </button>
                  {partners.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActiveOrg(p.id)}
                      className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2"
                    >
                      <Building2 className="h-3.5 w-3.5 text-gray-500" />
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <span className="text-sm text-white/70">{activeOrgName ?? t("topbar.org")}</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Language toggle */}
        <div className="flex items-center rounded-lg border border-white/20 overflow-hidden text-xs font-medium">
          <button
            onClick={() => setLocale("en")}
            className={`px-2.5 py-1.5 transition-colors ${
              locale === "en"
                ? "bg-white/20 text-white"
                : "text-white/70 hover:bg-white/10"
            }`}
          >
            ENG
          </button>
          <button
            onClick={() => setLocale("es")}
            className={`px-2.5 py-1.5 transition-colors ${
              locale === "es"
                ? "bg-white/20 text-white"
                : "text-white/70 hover:bg-white/10"
            }`}
          >
            ESP
          </button>
        </div>

        <button className="relative p-2 text-white/70 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-white leading-tight">
              {user.name ?? user.email}
            </p>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[user.role] ?? "bg-white/20 text-white"}`}
            >
              {user.role}
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 text-white/70 hover:text-white transition-colors"
          title={t("topbar.signOut")}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
