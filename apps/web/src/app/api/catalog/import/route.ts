import { NextResponse } from "next/server";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { prisma } from "@/lib/db";

const SYSTEM_CODES = ["S80", "S150", "S200"] as const;

type Row = {
  dieNumber?: string | null;
  canonicalName: string;
  systemCode: string;
  usefulWidthMm?: number | null;
  lbsPerMCored?: number | null;
  pricePerMCored?: number | null;
};

/** Normalize header for column matching */
function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse one row from sheet (array of values) using header indices */
function parseRow(
  headers: string[],
  row: unknown[],
  col: Record<string, number>
): Row | null {
  const get = (keys: string[]) => {
    for (const k of keys) {
      const i = col[k] ?? headers.findIndex((h) => norm(h) === k);
      if (i >= 0 && row[i] != null && row[i] !== "") return String(row[i]).trim();
    }
    return null;
  };
  const getNum = (keys: string[]) => {
    const v = get(keys);
    if (v == null) return null;
    const n = parseFloat(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const canonicalName = get(["canonical name", "canonicalname", "name", "nombre canónico", "pieza"]) ?? get(["0", "a"]);
  const systemRaw = get(["system", "system code", "systemcode", "sistema", "sys"]) ?? get(["2", "c"]);
  const systemCode = SYSTEM_CODES.includes(systemRaw as typeof SYSTEM_CODES[number])
    ? systemRaw
    : systemRaw?.toUpperCase().startsWith("S")
    ? (systemRaw as string)
    : null;
  if (!canonicalName || !systemCode || !SYSTEM_CODES.includes(systemCode as typeof SYSTEM_CODES[number]))
    return null;

  const dieNumber = get(["die #", "die number", "dienumber", "die", "molde", "molde #"]) ?? null;
  const usefulWidthMm = getNum(["useful width (mm)", "useful width", "usefulwidthmm", "width mm", "ancho útil"]) ?? null;
  const lbsPerMCored = getNum(["lbs/m cored", "lbs per m cored", "lbspermcored", "lbs"]) ?? null;
  const pricePerMCored =
    getNum(["price per m cored", "pricepermcored", "$/m cored", "price", "precio", "precio por m cored"]) ?? null;

  return {
    dieNumber: dieNumber || null,
    canonicalName,
    systemCode,
    usefulWidthMm: usefulWidthMm ?? null,
    lbsPerMCored: lbsPerMCored ?? null,
    pricePerMCored: pricePerMCored ?? null,
  };
}

/** Build column index: normalized header -> column index */
function buildColIndex(headers: string[]): Record<string, number> {
  const col: Record<string, number> = {};
  headers.forEach((h, i) => {
    col[norm(h)] = i;
    col[h] = i;
  });
  return col;
}

/** Parse CSV string into array of rows (array of cell values). Handles quoted fields. */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      cell += c;
    } else if (c === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.trim());
    if (row.some((v) => v !== "")) rows.push(row);
  }
  return rows;
}

/** POST: import catalog from Excel or CSV — superadmin only. */
export async function POST(req: Request) {
  try {
    await requirePlatformSuperadmin();
  } catch {
    return NextResponse.json(
      { error: "Forbidden: only superadmin can import the catalog" },
      { status: 403 }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File))
    return NextResponse.json(
      { error: "Missing file. Send as form field 'file'." },
      { status: 400 }
    );

  const dryRun = req.url.includes("dryRun=true");
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    let data: unknown[][];
    if (isCsv) {
      const text = buf.toString("utf-8").replace(/\r\n/g, "\n");
      data = parseCSV(text) as unknown[][];
    } else {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) return NextResponse.json({ error: "Empty workbook" }, { status: 400 });
      const sheet = wb.Sheets[firstSheet];
      data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    }
    if (!data.length) return NextResponse.json({ created: 0, updated: 0, unchanged: 0, total: 0 });

    const headerRow = data[0] as string[];
    const headers = headerRow.map((h) => String(h ?? ""));
    const col = buildColIndex(headers);
    const rows: Row[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = parseRow(headers, data[i] as unknown[], col);
      if (row) rows.push(row);
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const row of rows) {
      const existing = await prisma.catalogPiece.findUnique({
        where: {
          canonicalName_systemCode: {
            canonicalName: row.canonicalName,
            systemCode: row.systemCode,
          },
        },
      });
      const payload = {
        dieNumber: row.dieNumber ?? null,
        canonicalName: row.canonicalName,
        systemCode: row.systemCode,
        usefulWidthMm: row.usefulWidthMm ?? null,
        lbsPerMCored: row.lbsPerMCored ?? null,
        pricePerMCored: row.pricePerMCored ?? null,
        isActive: true,
      };
      if (dryRun) {
        if (existing) updated++; else created++;
        continue;
      }
      if (existing) {
        const same =
          (existing.dieNumber ?? "") === (row.dieNumber ?? "") &&
          (existing.usefulWidthMm ?? 0) === (row.usefulWidthMm ?? 0) &&
          (existing.lbsPerMCored ?? 0) === (row.lbsPerMCored ?? 0) &&
          (existing.pricePerMCored ?? 0) === (row.pricePerMCored ?? 0);
        if (same) {
          unchanged++;
          continue;
        }
        await prisma.catalogPiece.update({
          where: { id: existing.id },
          data: payload,
        });
        updated++;
      } else {
        await prisma.catalogPiece.create({ data: payload });
        created++;
      }
    }

    return NextResponse.json({
      created,
      updated,
      unchanged,
      total: rows.length,
    });
  } catch (e) {
    console.error("[api/catalog/import]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
