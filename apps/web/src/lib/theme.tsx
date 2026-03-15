"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export const THEME_COOKIE_NAME = "NEXT_THEME";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readThemeFromCookie(): Theme {
  if (typeof document === "undefined") return "light";
  const match = document.cookie.match(new RegExp(`${THEME_COOKIE_NAME}=([^;]+)`));
  const value = match?.[1];
  return value === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function persistTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const next = readThemeFromCookie();
    setThemeState(next);
    applyTheme(next);
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    persistTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      applyTheme(next);
      persistTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: mounted ? theme : "light", setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
