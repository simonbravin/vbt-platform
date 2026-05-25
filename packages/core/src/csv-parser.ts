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
  /** 0 = no length column or undifferentiated stock (single bucket). */
  heightMm: z.coerce.number().nonnegative(),
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

// Common header synonyms (lowercase). Longer phrases are matched first in findHeader.
const PIECE_NAME_HEADERS = [
  "family and type",
  "familia y tipo",
  "family and type name",
  "type name",
  "typename",
  "piece name",
  "piecename",
  "part type",
  "tipo de pieza",
  "tipo / pieza",
  "description",
  "descripcion",
  "descripción",
  "type",
  "tipo",
  "piece",
  "pieza",
  "perfil",
  "name",
  "element",
  "item",
  "component",
  "member",
];
const PIECE_CODE_HEADERS = [
  "piece code",
  "piececode",
  "part number",
  "part no",
  "code",
  "code revit",
  "mark",
  "matrix",
  "familia",
  "id",
];
const QTY_HEADERS = ["count", "quantity", "qty", "cantidad", "cant.", "count:", "units", "unidades", "number"];
const HEIGHT_HEADERS = [
  "height",
  "height_mm",
  "height (mm)",
  "alto",
  "alto_mm",
  "largeur",
  "length",
  "length_mm",
  "length (mm)",
  "longitud",
  "medida",
  "medida (mm)",
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

/** Avoid qty synonym "number" stealing Part Number / Matrix columns. */
function headerPartialMatch(headerNorm: string, synonym: string): boolean {
  if (synonym === "number" && (headerNorm.includes("part") || headerNorm.includes("matrix") || headerNorm.includes("mark"))) {
    return false;
  }
  if (synonym === "part" && headerNorm.includes("number")) return false;
  if (synonym === "piece" && headerNorm.includes("number")) return false;
  if (synonym === "tipo" && headerNorm.includes("cant")) return false;
  return headerNorm.includes(synonym) || synonym.includes(headerNorm);
}

function findHeader(headers: string[], synonyms: string[]): string | null {
  for (const h of headers) {
    if (synonyms.includes(h.toLowerCase().trim())) return h;
  }
  const byLength = [...synonyms].sort((a, b) => b.length - a.length);
  for (const h of headers) {
    const norm = h.toLowerCase().trim();
    for (const s of byLength) {
      if (headerPartialMatch(norm, s)) return h;
    }
  }
  return null;
}

/** Revit schedules often leave the Type column header blank (first cell empty). */
function normalizeHeaderRow(row: string[]): string[] {
  const out = row.map((c) => c.trim());
  if (out[0] !== undefined && !out[0] && out.length > 1) {
    const rest = out.slice(1).map((c) => c.toLowerCase());
    const hasQtyOrLen = rest.some(
      (c) =>
        QTY_HEADERS.includes(c) ||
        HEIGHT_HEADERS.includes(c) ||
        QTY_HEADERS.some((s) => c.includes(s)) ||
        HEIGHT_HEADERS.some((s) => c.includes(s))
    );
    if (hasQtyOrLen) out[0] = "Type";
  }
  return out;
}

/**
 * When no piece-name header matched, use the first unassigned column that looks like Revit type text.
 */
function resolvePieceNameHeader(
  headers: string[],
  headerMap: { pieceName: string | null; pieceCode: string | null; qty: string | null; heightMm: string | null },
  data: Record<string, string>[]
): string | null {
  if (headerMap.pieceName) return headerMap.pieceName;
  const used = new Set(
    [headerMap.pieceCode, headerMap.qty, headerMap.heightMm].filter((h): h is string => !!h)
  );
  for (const h of headers) {
    if (used.has(h)) continue;
    const samples = data
      .slice(0, 8)
      .map((r) => (r[h] ?? "").trim())
      .filter(Boolean);
    if (samples.length === 0) continue;
    if (samples.some((v) => /[a-zA-Z]/.test(v) && !/^#?\d+([.,]\d+)?$/.test(v))) return h;
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
  const headerRow = normalizeHeaderRow(allRows[headerRowIdx]);
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

  const headerMapBase = {
    pieceName: findHeader(headers, PIECE_NAME_HEADERS),
    pieceCode: findHeader(headers, PIECE_CODE_HEADERS),
    qty: findHeader(headers, QTY_HEADERS),
    heightMm: findHeader(headers, HEIGHT_HEADERS),
  };

  const dataRecords = parsed.data as Record<string, string>[];
  const pieceNameCol = resolvePieceNameHeader(headers, headerMapBase, dataRecords);
  const headerMap = { ...headerMapBase, pieceName: pieceNameCol };

  const rows: ParsedCsvRow[] = [];
  let invalidRows = 0;

  for (let i = 0; i < dataRecords.length; i++) {
    const raw = dataRecords[i];
    const rowNum = i + 1;

    const rawPieceName = headerMap.pieceName ? (raw[headerMap.pieceName] ?? "").trim() : "";
    const rawPieceCode = headerMap.pieceCode ? (raw[headerMap.pieceCode] ?? "").trim() : undefined;
    const rawQtyStr = headerMap.qty ? (raw[headerMap.qty] ?? "").trim() : "";
    const rawHeightStr = headerMap.heightMm ? (raw[headerMap.heightMm] ?? "").trim() : "";

    // Try to parse qty and height
    const rawQty = parseFloat(rawQtyStr.replace(/,/g, ""));
    let rawHeightMm = parseFloat(rawHeightStr.replace(/,/g, ""));
    if (!Number.isFinite(rawHeightMm)) rawHeightMm = 0;
    if (!headerMap.heightMm) rawHeightMm = 0;
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
