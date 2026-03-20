"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/context";
import { Locale } from "@/lib/i18n/translations";

function getForgotSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("auth.emailInvalid")),
  });
}
type FormData = z.infer<ReturnType<typeof getForgotSchema>>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { locale, setLocale, t } = useLanguage();
  const schema = useMemo(() => getForgotSchema(t), [t]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, locale }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("auth.errorGeneric"));
        return;
      }
      setSuccess(true);
    } catch {
      setError(t("auth.errorUnexpected"));
    } finally {
      setLoading(false);
    }
  }

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

        <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 ring-1 ring-white/10">
          <h2 className="text-xl font-semibold text-white mb-2">{t("auth.forgotPasswordTitle")}</h2>
          <p className="text-sm text-white/80 mb-6">{t("auth.forgotPasswordSub")}</p>

          {success ? (
            <div className="space-y-4">
              <div className="p-3 bg-green-900/50 border border-green-400/50 rounded-lg text-green-200 text-sm">
                {t("auth.forgotSuccess")}
              </div>
              <p className="text-center">
                <Link href="/login" className="text-vbt-orange hover:underline font-medium">
                  {t("auth.backToLogin")}
                </Link>
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-400/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">{t("auth.email")}</label>
                  <input
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-white/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
                    placeholder={t("auth.placeholderEmail")}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-vbt-blue hover:bg-blue-900 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
                </button>
              </form>
              <p className="text-center mt-6">
                <Link href="/login" className="text-sm text-white/80 hover:text-vbt-orange hover:underline">
                  {t("auth.backToLogin")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
