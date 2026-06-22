/**
 * Adapts `CatalogPiece` rows from Prisma to quote-engine / CSV matcher shapes.
 */

import { LBS_TO_KG } from "./calculations";
import type { PieceLookup, MatchResult } from "./csv-parser";
import { matchPiece, buildCodeIndex } from "./csv-parser";
import { normalizeAliasRaw } from "./normalizer";
import type { PieceMeta } from "./quote-engine";

export type CatalogPieceRow = {
  id: string;
  canonicalName: string;
  dieNumber: string | null;
  systemCode: string;
  usefulWidthMm: number | null;
  lbsPerMCored: number | null;
  kgPerMCored: number | null;
  pricePerM2Cored: number | null;
};

export function systemToCode(sc: string): "S80" | "S150" | "S200" | null {
  const u = sc.trim().toUpperCase();
  // Longer codes first so values like S150/S200 are not captured by endsWith("80").
  if (u === "S200" || u === "200" || u.endsWith("200")) return "S200";
  if (u === "S150" || u === "150" || u.endsWith("150")) return "S150";
  if (u === "S80" || u === "80" || u.endsWith("80")) return "S80";
  return null;
}

/** Build `PieceLookup[]` for `matchPiece` / `buildCodeIndex` from active catalog pieces. */
export function catalogPiecesToPieceLookup(pieces: CatalogPieceRow[]): PieceLookup[] {
  return pieces.map((p) => {
    const aliases: { aliasNormalized: string }[] = [];
    const canon = normalizeAliasRaw(p.canonicalName);
    if (canon) aliases.push({ aliasNormalized: canon });
    if (p.dieNumber?.trim()) {
      const d = normalizeAliasRaw(p.dieNumber.trim());
      if (d) aliases.push({ aliasNormalized: d });
    }
    return {
      id: p.id,
      canonicalNameNormalized: canon,
      aliases,
    };
  });
}

/** Index: normalized piece code / alias -> catalog piece id (for CSV `Type` / code column). */
export function buildCatalogCodeIndex(pieces: CatalogPieceRow[], lookups: PieceLookup[]): Map<string, string> {
  const idx = buildCodeIndex(lookups);
  for (const p of pieces) {
    if (p.dieNumber?.trim()) {
      idx.set(p.dieNumber.trim().toLowerCase(), p.id);
    }
    if (p.canonicalName.trim()) {
      idx.set(p.canonicalName.trim().toLowerCase(), p.id);
    }
  }
  return idx;
}

export function matchCatalogPieceRow(
  row: { rawPieceCode?: string; normalizedName: string },
  lookups: PieceLookup[],
  codeIndex: Map<string, string>
): MatchResult {
  const code = row.rawPieceCode?.trim();
  if (code) {
    const byLower = codeIndex.get(code.toLowerCase());
    if (byLower) return { pieceId: byLower, matchMethod: "EXACT_CODE" };
    const byNorm = codeIndex.get(normalizeAliasRaw(code));
    if (byNorm) return { pieceId: byNorm, matchMethod: "EXACT_CODE" };
  }
  return matchPiece(row, lookups, codeIndex);
}

export type CatalogPieceMetaOptions = {
  /**
   * Multiplier applied to catalog USD/m² (and derived USD/m) before building `PieceMeta.cost`.
   * Use `1 + visionLatamCommissionPct/100` when partner-facing factory cost must match effective list rates.
   */
  costMultiplier?: number;
};

/** Maps catalog piece id -> `PieceMeta` for `buildQuoteSnapshot` CSV lines. */
export function catalogPiecesToPieceMetaMap(
  pieces: CatalogPieceRow[],
  options?: CatalogPieceMetaOptions
): Record<string, PieceMeta> {
  const mult = typeof options?.costMultiplier === "number" && Number.isFinite(options.costMultiplier) && options.costMultiplier > 0 ? options.costMultiplier : 1;
  const out: Record<string, PieceMeta> = {};
  for (const p of pieces) {
    const usefulWidthM = (p.usefulWidthMm ?? 0) / 1000;
    let lbsPerMCored = p.lbsPerMCored ?? 0;
    if (!lbsPerMCored && p.kgPerMCored != null && p.kgPerMCored > 0) {
      lbsPerMCored = p.kgPerMCored / LBS_TO_KG;
    }
    const pricePerM2 = (p.pricePerM2Cored ?? 0) * mult;
    const pricePerMCored = usefulWidthM > 0 && pricePerM2 > 0 ? pricePerM2 * usefulWidthM : 0;
    const sc = systemToCode(p.systemCode);
    out[p.id] = {
      id: p.id,
      systemCode: sc ?? undefined,
      usefulWidthM,
      lbsPerMCored,
      lbsPerMUncored: lbsPerMCored,
      volumePerM: 0,
      cost:
        pricePerMCored > 0
          ? {
              pricePerMCored,
            }
          : undefined,
    };
  }
  return out;
}
