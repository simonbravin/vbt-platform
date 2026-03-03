/**
 * Normalize a piece alias/name for matching.
 * Removes SA####_ prefix, lowercases, collapses whitespace, strips punctuation.
 */
export function normalizeAliasRaw(raw: string): string {
  return raw
    .replace(/^SA\d{4}_/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function removeVersionPrefix(type: string): string {
  return type.replace(/^SA\d{4}_/i, "").trim();
}
