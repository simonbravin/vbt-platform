import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import type { Locale } from "@/lib/i18n/translations";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VBT Cost Calculator",
  description: "Vision Building Technologies – Internal Quoting Tool",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const initialLocale: Locale | null =
    localeCookie === "es" || localeCookie === "en" ? localeCookie : null;
  const lang = initialLocale ?? "en";

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={inter.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var m=document.cookie.match(/NEXT_THEME=([^;]+)/);if(m&&m[1]==='dark')document.documentElement.classList.add('dark');})();`,
          }}
        />
        <Providers initialLocale={initialLocale}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
