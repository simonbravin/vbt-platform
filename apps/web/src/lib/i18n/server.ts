import { cookies } from "next/headers";
import { getT, LOCALE_COOKIE_NAME } from "./translations";
import type { Locale } from "./translations";

/** Server Components: read locale cookie and return `getT(locale)`. */
export async function getServerT() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale: Locale = raw === "es" || raw === "en" ? raw : "en";
  return { locale, t: getT(locale) };
}
