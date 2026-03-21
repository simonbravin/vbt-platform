/** Client-side filter: any needle substring in any haystack (case-insensitive). */
export function documentMatchesSearchQuery(
  query: string,
  haystacks: (string | null | undefined)[]
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystacks.some((h) => (h ?? "").toLowerCase().includes(q));
}
