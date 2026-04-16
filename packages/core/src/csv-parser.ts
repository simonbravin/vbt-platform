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
  /** Schedule unit count; 0 is allowed (inventory / Revit rows with no movement). */
  qty: z.coerce.number().nonnegative(),
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
const PIECE_CODE_HEADERS = [
  "piece code",
  "piececode",
  "code",
  "code revit",
  "mark",
  "matrix",
  "familia",
  "id",
];
const QTY_HEADERS = ["count", "quantity", "qty", "cantidad", "count:", "number", "units", "unidades"];
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

// All column names we recognize as real data headers
const ALL_KNOWN_HEADERS = [
  ...PIECE_NAME_HEADERS,
  ...PIECE_CODE_HEADERS,
  ...QTY_HEADERS,
  ...HEIGHT_HEADERS,
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

// ─── Revit meta-row detection ─────────────────────────────────────────────────

/**
 * Revit table schedule exports include subtotal and grand-total rows.
 * Examples:
 *   "SA2024_6in x 9in Form: 2034,,,"  <- group subtotal
 *   "Grand total: 2487,,,"             <- grand total
 *
 * They are identified by:
 *  - "Grand total" prefix, OR
 *  - First cell ends with ": <number>" AND the qty cell is empty
 */
function isRevitMetaRow(row: string[]): boolean {
  // Completely empty rows (blank lines between sections)
  if (row.every(c => !c.trim())) return true;
  const first = (row[0] ?? "").trim();
  if (!first) return false;
  if (first.toLowerCase().startsWith("grand total")) return true;
  // subtotal: "TypeName: 2034" with no qty value
  if (/:\s*\d+\s*$/.test(first) && !(row[1] ?? "").trim()) return true;
  return false;
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

  // ── Step 1: raw parse to find the real header row ─────────────────────────
  // Revit wall schedule CSVs often have a project-title row as row 1, with the
  // actual column headers (Type, QTY, Length, …) in row 2.
  // We scan the first few rows to find the one that contains known column names.
  const rawParse = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  const allRows = rawParse.data;

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(allRows.length, 5); i++) {
    const cells = allRows[i].map((c) => c.toLowerCase().trim());
    if (cells.some((c) => ALL_KNOWN_HEADERS.includes(c))) {
      headerRowIdx = i;
      break;
    }
  }

  // ── Step 2: filter out Revit meta rows (subtotals, grand total) ───────────
  const headerRow = allRows[headerRowIdx];
  const dataRows = allRows.slice(headerRowIdx + 1).filter((row) => !isRevitMetaRow(row));

  // ── Step 3: re-parse with proper headers ──────────────────────────────────
  const cleanedCsv = Papa.unparse([headerRow, ...dataRows]);

  const parsed = Papa.parse(cleanedCsv, {
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
    let rawHeightMm = parseFloat(rawHeightStr.replace(/,/g, ""));
    // Inventory / UI exports often label wall height in meters (e.g. "Height (m)"); Revit schedules use mm.
    if (
      headerMap.heightMm &&
      /\(\s*m\s*\)/i.test(headerMap.heightMm) &&
      Number.isFinite(rawHeightMm) &&
      rawHeightMm > 0 &&
      rawHeightMm < 1000
    ) {
      rawHeightMm = rawHeightMm * 1000;
    }

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
