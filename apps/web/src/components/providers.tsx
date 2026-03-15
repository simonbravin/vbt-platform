"use client";

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/lib/i18n/context";
import { ThemeProvider } from "@/lib/theme";
import type { Locale } from "@/lib/i18n/translations";

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale | null;
}) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LanguageProvider initialLocale={initialLocale}>{children}</LanguageProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
