"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/context";
import { Locale } from "@/lib/i18n/translations";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useLanguage();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    setLoading(false);

    if (!result?.ok) {
      if (result?.error === "PENDING") {
        router.push("/pending");
        return;
      }
      setError(t("auth.invalidCredentials"));
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 ring-1 ring-white/10">
      <h2 className="text-xl font-semibold text-white mb-6">{t("auth.signIn")}</h2>

      {searchParams.get("reset") === "success" && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-400/50 rounded-lg text-green-200 text-sm">
          {t("auth.resetSuccess")}
        </div>
      )}
      {searchParams.get("message") && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-400/50 rounded-lg text-green-200 text-sm">
          {decodeURIComponent(searchParams.get("message") ?? "")}
        </div>
      )}
      {searchParams.get("error") === "INACTIVE" && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-400/50 rounded-lg text-red-200 text-sm">
          {t("auth.suspended")}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-400/50 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">
            {t("auth.email")}
          </label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            className="w-full px-3 py-2 bg-white text-gray-900 border border-white/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
className="w-full px-3 py-2 pr-10 bg-white text-gray-900 border border-white/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
            placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-vbt-blue hover:bg-blue-900 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t("auth.signingIn") : t("auth.signInBtn")}
        </button>
        <p className="text-center mt-3">
          <Link href="/forgot-password" className="text-sm text-white/80 hover:text-vbt-orange hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </p>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-white/80">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="text-vbt-orange hover:underline font-medium">
            {t("auth.requestAccess")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Language toggle – top right */}
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

      {/* Background: gradient + subtle grid */}
      <div className="absolute inset-0 bg-gradient-to-br from-vbt-blue via-blue-900 to-slate-900" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      {/* Soft glow accent */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-vbt-orange/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-blue-400/15 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Title */}
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
          <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">VBT Cost Calculator</h1>
          <p className="text-white/70 mt-1.5 text-sm">Vision Building Technologies</p>
        </div>

        <Suspense fallback={<div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 text-center text-gray-400 text-sm">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
