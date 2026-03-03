"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/context";

export default function PendingPage() {
  const t = useT();

  return (
    <div className="min-h-screen bg-gradient-to-br from-vbt-blue to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("auth.pendingTitle")}</h2>
        <p className="text-gray-500 mb-6">{t("auth.pendingMsg")}</p>
        <p className="text-sm text-gray-400 mb-6">
          Need urgent access? Contact{" "}
          <a href="mailto:simon@visionlatam.com" className="text-vbt-orange hover:underline">
            simon@visionlatam.com
          </a>
        </p>
        <Link href="/login" className="inline-flex items-center text-sm text-vbt-blue hover:underline">
          ← {t("auth.signInLink")}
        </Link>
      </div>
    </div>
  );
}
