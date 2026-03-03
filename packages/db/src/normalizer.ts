/**
 * Normalize a piece alias for matching:
 * - lowercase
 * - remove SA####_ prefix
 * - collapse whitespace
 * - remove special characters except alphanumeric, spaces, hyphens
 */
export function normalizeAliasRaw(raw: string): string {
  return raw
    .replace(/^SA\d{4}_/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
