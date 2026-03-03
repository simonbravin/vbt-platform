import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { normalizeAliasRaw } from "@vbt/core";
import * as xlsx from "xlsx";

function removeVersionPrefix(type: string): string {
  return type.replace(/^SA\d{4}_/i, "").trim();
}

function deriveSystemCode(category: string): "S80" | "S150" | "S200" | null {
  const c = (category ?? "").toLowerCase();
  if (c.includes("80mm")) return "S80";
  if (c.includes("6in") || c.includes("150")) return "S150";
  if (c.includes("8in") || c.includes("200")) return "S200";
  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "true";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = xlsx.utils.sheet_to_json(worksheet);

    // Get system IDs
    const systems = await prisma.systemType.findMany();
    const systemMap = Object.fromEntries(systems.map((s) => [s.code, s.id]));

    const results = {
      total: rows.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: [] as string[],
      preview: [] as any[],
    };

    for (const row of rows) {
      const typeRaw: string = row["Type"] ?? "";
      if (!typeRaw) continue;

      const category: string = row["Category"] ?? "";
      const canonicalName = removeVersionPrefix(typeRaw);
      const canonicalNameNormalized = normalizeAliasRaw(canonicalName);
      const systemCode = deriveSystemCode(category);
      const usefulWidthMm: number = row["UsefulWidth_mm"] ?? 0;

      const newData = {
        canonicalName,
        canonicalNameNormalized,
        categoryRaw: category,
        systemCode: systemCode ?? undefined,
        systemId: systemCode ? systemMap[systemCode] : undefined,
        usefulWidthMm,
        usefulWidthM: usefulWidthMm / 1000,
        lbsPerMUncored: row["lbs per m - Uncored"] ?? 0,
        lbsPerMCored: row["lbs per m - Cored"] ?? 0,
        volumePerM: row["Volume per m"] ?? 0,
        dieNumber: row["Die"] ? String(row["Die"]) : undefined,
      };

      const existing = await prisma.pieceCatalog.findUnique({
        where: { canonicalNameNormalized },
        include: { costs: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
      });

      const previewItem = {
        canonicalName,
        systemCode,
        usefulWidthMm,
        action: existing ? "update" : "create",
        changes: {} as Record<string, any>,
      };

      if (existing) {
        // Check for changes
        const hasCostChange =
          (existing.costs[0]?.pricePerMCored ?? 0) !== (row["$ per m Cored"] ?? 0);
        const hasMetaChange =
          existing.usefulWidthMm !== usefulWidthMm ||
          existing.lbsPerMCored !== newData.lbsPerMCored;

        if (hasCostChange) previewItem.changes.cost = { new: row["$ per m Cored"] };
        if (hasMetaChange) previewItem.changes.meta = "updated";

        if (!hasCostChange && !hasMetaChange) {
          results.unchanged++;
          previewItem.action = "unchanged";
        } else {
          results.updated++;
        }
      } else {
        results.created++;
      }

      results.preview.push(previewItem);

      if (!dryRun) {
        const piece = await prisma.pieceCatalog.upsert({
          where: { canonicalNameNormalized },
          update: newData,
          create: newData,
        });

        // Upsert cost
        await prisma.pieceCost.upsert({
          where: { id: `import-${piece.id}` },
          update: {
            pricePer5000ftCored: row["$ per 5000' Cored"] ?? 0,
            pricePerFtCored: row["$ per feet Cored"] ?? 0,
            pricePerMCored: row["$ per m Cored"] ?? 0,
          },
          create: {
            id: `import-${piece.id}`,
            pieceId: piece.id,
            pricePer5000ftCored: row["$ per 5000' Cored"] ?? 0,
            pricePerFtCored: row["$ per feet Cored"] ?? 0,
            pricePerMCored: row["$ per m Cored"] ?? 0,
            notes: "Imported from Excel",
          },
        });

        // Upsert aliases
        const aliasesToCreate = [
          { raw: typeRaw, norm: normalizeAliasRaw(typeRaw) },
          { raw: canonicalName, norm: normalizeAliasRaw(canonicalName) },
        ];

        for (const alias of aliasesToCreate) {
          await prisma.pieceAlias
            .upsert({
              where: { aliasNormalized_pieceId: { aliasNormalized: alias.norm, pieceId: piece.id } },
              update: {},
              create: {
                pieceId: piece.id,
                aliasRaw: alias.raw,
                aliasNormalized: alias.norm,
                source: "EXCEL_IMPORT",
              },
            })
            .catch(() => {});
        }
      }
    }

    if (!dryRun) {
      await createAuditLog({
        orgId: user.orgId,
        userId: user.id,
        action: "CATALOG_IMPORTED",
        entityType: "PieceCatalog",
        meta: { created: results.created, updated: results.updated },
      });
    }

    return NextResponse.json({ ...results, dryRun });
  } catch (error) {
    console.error("Catalog import error:", error);
    return NextResponse.json({ error: "Failed to import file" }, { status: 500 });
  }
}
