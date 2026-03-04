/**
 * Normalize a piece alias/name for matching.
 * Removes SA####_ prefix, lowercases, collapses whitespace, strips punctuation.
 */
export function normalizeAliasRaw(raw: string): string {
  // Strip Revit "FamilyName: TypeName" prefix (e.g. "SA2025: SA2025_6in x 9in Form" → "SA2025_6in x 9in Form")
  const colonIdx = raw.indexOf(": ");
  const stripped = colonIdx !== -1 ? raw.slice(colonIdx + 2) : raw;
  return stripped
    .replace(/^SA\d{4}_/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function removeVersionPrefix(type: string): string {
  return type.replace(/^SA\d{4}_/i, "").trim();
}
