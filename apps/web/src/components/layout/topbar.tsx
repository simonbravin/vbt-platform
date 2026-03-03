"use client";

import { signOut } from "next-auth/react";
import { LogOut, User, Bell } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

interface TopBarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
  };
}

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  SALES: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-600",
};

export function TopBar({ user }: TopBarProps) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-800">{t("topbar.title")}</h1>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-500">{t("topbar.org")}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Language toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          <button
            onClick={() => setLocale("en")}
            className={`px-2.5 py-1.5 transition-colors ${
              locale === "en"
                ? "bg-vbt-blue text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            ENG
          </button>
          <button
            onClick={() => setLocale("es")}
            className={`px-2.5 py-1.5 transition-colors ${
              locale === "es"
                ? "bg-vbt-blue text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            ESP
          </button>
        </div>

        <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-vbt-blue flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-800 leading-tight">
              {user.name ?? user.email}
            </p>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}
            >
              {user.role}
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          title={t("topbar.signOut")}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
