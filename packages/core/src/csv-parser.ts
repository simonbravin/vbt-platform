import Papa from "papaparse";
import { z } from "zod";
import { normalizeAliasRaw } from "./normalizer";

// ─── CSV Row Schema ────────────────────────────────────────────────────────────

/**
 * Expected CSV format from Revit schedule export.
 * Header names are flexible – we map them.
 */
export const RevitCsvRowSchema = z.object({
  pieceName: z.string().min(1),
  pieceCode: z.string().optional(),
  qty: z.coerce.number().positive(),
  heightMm: z.coerce.number().positive(),
});

export type RevitCsvRow = z.infer<typeof RevitCsvRowSchema>;

export interface ParsedCsvRow {
  rowNum: number;
  rawPieceName: string;
  rawPieceCode?: string;
  rawQty: number;
  rawHeightMm: number;
  normalizedName: string;
  parseError?: string;
}

// ─── Header mapping ───────────────────────────────────────────────────────────

// Common header synonyms (lowercase)
const PIECE_NAME_HEADERS = ["type", "piece name", "piecename", "name", "element", "piece", "perfil", "tipo"];
const PIECE_CODE_HEADERS = ["piece code", "piececode", "code", "code revit", "mark", "familia", "id"];
const QTY_HEADERS = ["count", "quantity", "qty", "cantidad", "count:", "number"];
const HEIGHT_HEADERS = [
  "height",
  "height_mm",
  "alto",
  "alto_mm",
  "largeur",
  "length",
  "length_mm",
  "longitud",
  "altura",
  "altura_mm",
];

function findHeader(headers: string[], synonyms: string[]): string | null {
  for (const h of headers) {
    if (synonyms.includes(h.toLowerCase().trim())) return h;
  }
  // partial match
  for (const h of headers) {
    for (const s of synonyms) {
      if (h.toLowerCase().includes(s) || s.includes(h.toLowerCase().trim())) return h;
    }
  }
  return null;
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  headerMap: {
    pieceName: string | null;
    pieceCode: string | null;
    qty: string | null;
    heightMm: string | null;
  };
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
}

export function parseRevitCsv(csvText: string): CsvParseResult {
  const errors: string[] = [];

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    errors.push(...parsed.errors.map((e) => e.message));
  }

  const headers = parsed.meta.fields ?? [];

  const headerMap = {
    pieceName: findHeader(headers, PIECE_NAME_HEADERS),
    pieceCode: findHeader(headers, PIECE_CODE_HEADERS),
    qty: findHeader(headers, QTY_HEADERS),
    heightMm: findHeader(headers, HEIGHT_HEADERS),
  };

  const rows: ParsedCsvRow[] = [];
  let invalidRows = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const raw = parsed.data[i] as Record<string, string>;
    const rowNum = i + 1;

    const rawPieceName = headerMap.pieceName ? (raw[headerMap.pieceName] ?? "").trim() : "";
    const rawPieceCode = headerMap.pieceCode ? (raw[headerMap.pieceCode] ?? "").trim() : undefined;
    const rawQtyStr = headerMap.qty ? (raw[headerMap.qty] ?? "").trim() : "";
    const rawHeightStr = headerMap.heightMm ? (raw[headerMap.heightMm] ?? "").trim() : "";

    // Try to parse qty and height
    const rawQty = parseFloat(rawQtyStr.replace(/,/g, ""));
    const rawHeightMm = parseFloat(rawHeightStr.replace(/,/g, ""));

    const parseResult = RevitCsvRowSchema.safeParse({
      pieceName: rawPieceName,
      pieceCode: rawPieceCode || undefined,
      qty: rawQty,
      heightMm: rawHeightMm,
    });

    if (!parseResult.success) {
      invalidRows++;
      const errorMsg = parseResult.error.issues.map((i) => i.message).join("; ");
      rows.push({
        rowNum,
        rawPieceName,
        rawPieceCode: rawPieceCode || undefined,
        rawQty: isNaN(rawQty) ? 0 : rawQty,
        rawHeightMm: isNaN(rawHeightMm) ? 0 : rawHeightMm,
        normalizedName: normalizeAliasRaw(rawPieceName),
        parseError: errorMsg,
      });
    } else {
      rows.push({
        rowNum,
        rawPieceName: parseResult.data.pieceName,
        rawPieceCode: parseResult.data.pieceCode,
        rawQty: parseResult.data.qty,
        rawHeightMm: parseResult.data.heightMm,
        normalizedName: normalizeAliasRaw(parseResult.data.pieceName),
      });
    }
  }

  return {
    rows,
    headerMap,
    totalRows: rows.length,
    validRows: rows.length - invalidRows,
    invalidRows,
    errors,
  };
}

// ─── Piece Matching ───────────────────────────────────────────────────────────

export interface PieceLookup {
  id: string;
  canonicalNameNormalized: string;
  aliases: { aliasNormalized: string }[];
}

export type MatchMethod = "EXACT_CODE" | "ALIAS" | "CANONICAL" | "UNMATCHED";

export interface MatchResult {
  pieceId: string | null;
  matchMethod: MatchMethod;
}

export function matchPiece(
  row: Pick<ParsedCsvRow, "rawPieceCode" | "normalizedName">,
  catalog: PieceLookup[],
  codeIndex: Map<string, string>
): MatchResult {
  // 1) Exact by piece code
  if (row.rawPieceCode) {
    const id = codeIndex.get(row.rawPieceCode.toLowerCase());
    if (id) return { pieceId: id, matchMethod: "EXACT_CODE" };
  }

  // 2) Alias normalized match
  for (const piece of catalog) {
    for (const alias of piece.aliases) {
      if (alias.aliasNormalized === row.normalizedName) {
        return { pieceId: piece.id, matchMethod: "ALIAS" };
      }
    }
  }

  // 3) Canonical normalized match
  for (const piece of catalog) {
    if (piece.canonicalNameNormalized === row.normalizedName) {
      return { pieceId: piece.id, matchMethod: "CANONICAL" };
    }
  }

  return { pieceId: null, matchMethod: "UNMATCHED" };
}

export function buildCodeIndex(catalog: PieceLookup[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const p of catalog) {
    for (const alias of p.aliases) {
      idx.set(alias.aliasNormalized, p.id);
    }
  }
  return idx;
}
