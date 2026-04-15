import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError } from "@/lib/tenant";
import {
  parseRevitCsv,
  catalogPiecesToPieceLookup,
  buildCatalogCodeIndex,
  matchCatalogPieceRow,
  createBulkTransactions,
  isInventoryMovementOut,
  type InventoryTransactionType,
} from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

const VALID_TYPES: InventoryTransactionType[] = [
  "purchase_in",
  "sale_out",
  "project_consumption",
  "project_surplus",
  "adjustment_in",
  "adjustment_out",
  "transfer_in",
  "transfer_out",
];

const MAX_FILE_BYTES = 12 * 1024 * 1024;

async function fileToCsvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const first = wb.SheetNames[0];
    if (!first) return "";
    const sheet = wb.Sheets[first];
    if (!sheet) return "";
    return XLSX.utils.sheet_to_csv(sheet);
  }
  return file.text();
}

async function postHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required (CSV or Excel)" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 12 MB)" }, { status: 400 });
  }

  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "").trim();
  const dryRun =
    formData.get("dryRun") === "true" ||
    formData.get("dryRun") === "1" ||
    formData.get("dryRun") === "yes";

  const notesRaw = formData.get("notes");
  const notes = typeof notesRaw === "string" ? notesRaw.trim() : "";

  if (!warehouseId || !typeRaw || !VALID_TYPES.includes(typeRaw as InventoryTransactionType)) {
    return NextResponse.json(
      {
        error:
          "warehouseId and type are required; type must be one of: " + VALID_TYPES.join(", "),
      },
      { status: 400 }
    );
  }
  const type = typeRaw as InventoryTransactionType;

  let organizationId: string;
  if (ctx.isPlatformSuperadmin && formData.get("organizationId")) {
    organizationId = String(formData.get("organizationId")).trim();
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is empty" }, { status: 400 });
    }
  } else if (ctx.activeOrgId) {
    organizationId = ctx.activeOrgId;
  } else {
    return NextResponse.json({ error: "No organization context" }, { status: 400 });
  }

  const warehouseOk = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId },
    select: { id: true },
  });
  if (!warehouseOk) {
    return NextResponse.json(
      { error: "Warehouse not found or does not belong to the selected organization" },
      { status: 400 }
    );
  }

  const csvText = await fileToCsvText(file);
  if (!csvText.trim()) {
    return NextResponse.json({ error: "Empty file or sheet" }, { status: 400 });
  }

  const parsed = parseRevitCsv(csvText);

  const catalogRows = await prisma.catalogPiece.findMany({
    where: { isActive: true },
    select: {
      id: true,
      canonicalName: true,
      dieNumber: true,
      systemCode: true,
      usefulWidthMm: true,
      lbsPerMCored: true,
      kgPerMCored: true,
      pricePerM2Cored: true,
    },
  });

  const lookups = catalogPiecesToPieceLookup(catalogRows);
  const codeIndex = buildCatalogCodeIndex(catalogRows, lookups);
  const pieceMetaById = new Map(catalogRows.map((p) => [p.id, p]));

  type Unmatched = { rowNum: number; rawPieceName: string; rawPieceCode?: string };
  const unmatched: Unmatched[] = [];
  let invalidParseRows = 0;
  let matchedDataRows = 0;
  const qtyByPiece = new Map<string, number>();

  for (const row of parsed.rows) {
    if (row.parseError) {
      invalidParseRows++;
      continue;
    }
    const match = matchCatalogPieceRow(row, lookups, codeIndex);
    if (!match.pieceId) {
      unmatched.push({
        rowNum: row.rowNum,
        rawPieceName: row.rawPieceName,
        rawPieceCode: row.rawPieceCode,
      });
      continue;
    }
    matchedDataRows++;
    qtyByPiece.set(match.pieceId, (qtyByPiece.get(match.pieceId) ?? 0) + row.rawQty);
  }

  const sign = isInventoryMovementOut(type) ? -1 : 1;
  const aggregated = [...qtyByPiece.entries()].map(([catalogPieceId, quantity]) => {
    const p = pieceMetaById.get(catalogPieceId);
    return {
      catalogPieceId,
      canonicalName: p?.canonicalName ?? catalogPieceId,
      systemCode: p?.systemCode ?? "",
      quantityFromFile: quantity,
      quantityDelta: sign * quantity,
    };
  });
  aggregated.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));

  const lines = aggregated.map((a) => ({ catalogPieceId: a.catalogPieceId, quantity: a.quantityFromFile }));

  const noteParts = [`Bulk import: ${file.name}`];
  if (notes) noteParts.push(notes);
  const combinedNotes = noteParts.join("\n");

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      parseSummary: {
        totalRows: parsed.totalRows,
        invalidParseRows,
        unmatchedRows: unmatched.length,
        matchedDataRows,
        csvErrors: parsed.errors,
      },
      headerMap: parsed.headerMap,
      unmatched: unmatched.slice(0, 80),
      aggregated,
      hasApplyableLines: lines.length > 0,
    });
  }

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "No rows matched catalog pieces; nothing to apply." },
      { status: 400 }
    );
  }

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };

  try {
    const result = await createBulkTransactions(prisma, tenantCtx, {
      warehouseId,
      organizationId,
      type,
      lines,
      notes: combinedNotes,
      createdByUserId: ctx.userId,
    });
    return NextResponse.json({
      dryRun: false,
      ...result,
      parseSummary: {
        totalRows: parsed.totalRows,
        invalidParseRows,
        unmatchedRows: unmatched.length,
        matchedDataRows,
      },
      aggregated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bulk import failed";
    if (
      message.includes("not found") ||
      message.includes("another organization") ||
      message.includes("Insufficient") ||
      message.includes("No lines")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw e;
  }
}

export const POST = withSaaSHandler({ rateLimitTier: "create_update", module: "inventory" }, postHandler);
