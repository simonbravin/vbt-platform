"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { translations, Locale, LOCALE_COOKIE_NAME } from "./translations";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale | null;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale === "es" || initialLocale === "en") return initialLocale;
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`));
      const fromCookie = match?.[1];
      if (fromCookie === "es" || fromCookie === "en") return fromCookie;
    }
    return "en";
  });

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = translations[locale] as Record<string, string>;
      let str = dict[key] ?? translations["en"][key as keyof typeof translations.en] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          str = str.replace(`{{${k}}}`, String(v));
        });
      }
      return str;
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

/** Convenience alias */
export function useT() {
  return useLanguage().t;
}
