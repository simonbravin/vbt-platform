"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/context";
import { Locale } from "@/lib/i18n/translations";

function getResetSchema(t: (key: string) => string) {
  return z
    .object({
      password: z
        .string()
        .min(8, t("auth.passwordMin8"))
        .regex(/[A-Z]/, t("auth.passwordUppercase"))
        .regex(/[0-9]/, t("auth.passwordNumber")),
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t("auth.passwordMismatch"),
      path: ["confirmPassword"],
    });
}
type FormData = z.infer<ReturnType<typeof getResetSchema>>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { locale, setLocale, t } = useLanguage();

  const schema = useMemo(() => getResetSchema(t), [t]);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!token) setError(t("auth.missingResetLink"));
  }, [token, t]);

  async function onSubmit(data: FormData) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("auth.errorGeneric"));
        return;
      }
      router.push("/login?reset=success");
      router.refresh();
    } catch {
      setError(t("auth.errorUnexpected"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 ring-1 ring-white/10">
        <p className="text-red-200 text-sm mb-4">{error}</p>
        <Link href="/forgot-password" className="text-vbt-orange hover:underline font-medium">
          {t("auth.requestResetLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 ring-1 ring-white/10">
      <h2 className="text-xl font-semibold text-white mb-2">{t("auth.resetPasswordTitle")}</h2>
      <p className="text-sm text-white/80 mb-6">{t("auth.resetPasswordSub")}</p>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-400/50 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">{t("auth.newPassword")}</label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="w-full px-3 py-2 pr-10 bg-white text-gray-900 border border-white/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-1">{t("auth.confirmPassword")}</label>
          <div className="relative">
            <input
              {...register("confirmPassword")}
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              className="w-full px-3 py-2 pr-10 bg-white text-gray-900 border border-white/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
              aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showConfirmPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-vbt-blue hover:bg-blue-900 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t("auth.settingPassword") : t("auth.setPassword")}
        </button>
      </form>
      <p className="text-center mt-6">
        <Link href="/login" className="text-sm text-white/80 hover:text-vbt-orange hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20">
        <div className="flex items-center rounded-xl border border-white/25 bg-white/5 backdrop-blur-sm overflow-hidden text-xs font-medium shadow-lg">
          {(["en", "es"] as Locale[]).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={`px-3 py-2 transition-colors ${
                locale === l ? "bg-white text-vbt-blue" : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              {l === "en" ? "ENG" : "ESP"}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-vbt-blue via-blue-900 to-slate-900" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--auth-grid-overlay)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--auth-grid-overlay)) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-vbt-orange/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-blue-400/15 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4 drop-shadow-lg">
            <Image
              src="/logo-vbt-white.png"
              alt="Vision Building Technologies"
              width={320}
              height={72}
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">{t("topbar.title")}</h1>
          <p className="text-white/70 mt-1.5 text-sm">{t("auth.appSubtitle")}</p>
        </div>

        <Suspense fallback={
          <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 text-center text-white/70">
            {t("common.loading")}
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
