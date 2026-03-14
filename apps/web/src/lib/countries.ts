/**
 * Static country list for forms and filters.
 * Use countryCode (ISO 3166-1 alpha-2) on Project/Client; no DB-backed countries module.
 */
export type CountryOption = { code: string; name: string };

export const STATIC_COUNTRIES: CountryOption[] = [
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brazil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "EC", name: "Ecuador" },
  { code: "SV", name: "El Salvador" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "MX", name: "Mexico" },
  { code: "NI", name: "Nicaragua" },
  { code: "PA", name: "Panama" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "UY", name: "Uruguay" },
  { code: "US", name: "United States" },
  { code: "VE", name: "Venezuela" },
];

export function getCountryByCode(code: string): CountryOption | undefined {
  return STATIC_COUNTRIES.find((c) => c.code === code);
}

export function getCountryName(code: string | null | undefined): string {
  if (!code) return "";
  return getCountryByCode(code)?.name ?? code;
}
