import { PrismaClient, SystemCode } from "@prisma/client";
import * as xlsx from "xlsx";
import * as path from "path";
import * as bcrypt from "bcryptjs";
import { normalizeAliasRaw } from "../src/normalizer";

const prisma = new PrismaClient();

const SUPERADMIN_EMAIL =
  process.env.SUPERADMIN_EMAIL ?? "simon@visionbuildingtechs.com";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "ChangeMe123!";

function deriveSystemCode(category: string): SystemCode | null {
  const c = category.toLowerCase();
  if (c.includes("80mm")) return SystemCode.S80;
  if (c.includes("6in") || c.includes("150")) return SystemCode.S150;
  if (c.includes("8in") || c.includes("200")) return SystemCode.S200;
  return null;
}

function removeVersionPrefix(type: string): string {
  return type.replace(/^SA\d{4}_/, "").trim();
}

async function main() {
  console.log("🌱 Seeding VBT Cotizador...");

  // ── 1. Org ──────────────────────────────────────────────────────────────
  const org = await prisma.org.upsert({
    where: { slug: "vision-latam" },
    update: {},
    create: {
      name: "Vision Latam",
      slug: "vision-latam",
      baseUom: "M",
      weightUom: "KG",
      minRunFt: 5000,
      rateS80: 37,
      rateS150: 67,
      rateS200: 85,
      rateGlobal: 60,
    },
  });
  console.log("✅ Org created:", org.name);

  // ── 2. SUPERADMIN user ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: { passwordHash, status: "ACTIVE" },
    create: {
      email: SUPERADMIN_EMAIL,
      name: "Simon (SUPERADMIN)",
      passwordHash,
      status: "ACTIVE",
    },
  });

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: superAdmin.id } },
    update: { role: "SUPERADMIN" },
    create: {
      orgId: org.id,
      userId: superAdmin.id,
      role: "SUPERADMIN",
    },
  });
  console.log("✅ SUPERADMIN user:", superAdmin.email);

  // ── 3. SystemTypes ───────────────────────────────────────────────────────
  const systems = [
    {
      code: SystemCode.S80,
      name: "S80 (80mm)",
      thicknessMm: 80,
      concreteM3PerM2: 0.08,
      steelKgPerM2: 4,
    },
    {
      code: SystemCode.S150,
      name: "S150 (6in/150mm)",
      thicknessMm: 150,
      concreteM3PerM2: 0.15,
      steelKgPerM2: 6,
    },
    {
      code: SystemCode.S200,
      name: "S200 (8in/200mm)",
      thicknessMm: 200,
      concreteM3PerM2: 0.2,
      steelKgPerM2: 8,
    },
  ];

  const systemMap: Record<SystemCode, string> = {} as Record<SystemCode, string>;
  for (const s of systems) {
    const st = await prisma.systemType.upsert({
      where: { code: s.code },
      update: { ...s },
      create: { ...s },
    });
    systemMap[s.code] = st.id;
  }
  console.log("✅ SystemTypes created");

  // ── 4. Ingest perfiles_master.xlsx ──────────────────────────────────────
  const xlsxPath = path.resolve(__dirname, "../../../docs/perfiles_master.xlsx");
  let xlsxRows: any[] = [];
  try {
    const wb = xlsx.readFile(xlsxPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    xlsxRows = xlsx.utils.sheet_to_json(ws);
    console.log(`📊 Excel rows to ingest: ${xlsxRows.length}`);
  } catch (e) {
    console.warn("⚠️  Could not read perfiles_master.xlsx, skipping catalog seed:", e);
  }

  for (const row of xlsxRows) {
    const typeRaw: string = row["Type"] ?? "";
    const category: string = row["Category"] ?? "";
    const canonicalName = removeVersionPrefix(typeRaw);
    const canonicalNameNormalized = normalizeAliasRaw(canonicalName);
    const systemCode = deriveSystemCode(category);
    const usefulWidthMm: number = row["UsefulWidth_mm"] ?? 0;

    // Upsert PieceCatalog
    const piece = await prisma.pieceCatalog.upsert({
      where: { canonicalNameNormalized },
      update: {
        canonicalName,
        categoryRaw: category,
        systemCode: systemCode ?? undefined,
        systemId: systemCode ? systemMap[systemCode] : undefined,
        usefulWidthMm,
        usefulWidthM: usefulWidthMm / 1000,
        lbsPerMUncored: row["lbs per m - Uncored"] ?? 0,
        lbsPerMCored: row["lbs per m - Cored"] ?? 0,
        volumePerM: row["Volume per m"] ?? 0,
        dieNumber: row["Die"] ? String(row["Die"]) : undefined,
      },
      create: {
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
      },
    });

    // PieceCost
    await prisma.pieceCost.upsert({
      where: { id: `seed-${piece.id}` },
      update: {
        pricePer5000ftCored: row["$ per 5000' Cored"] ?? 0,
        pricePerFtCored: row["$ per feet Cored"] ?? 0,
        pricePerMCored: row["$ per m Cored"] ?? 0,
      },
      create: {
        id: `seed-${piece.id}`,
        pieceId: piece.id,
        pricePer5000ftCored: row["$ per 5000' Cored"] ?? 0,
        pricePerFtCored: row["$ per feet Cored"] ?? 0,
        pricePerMCored: row["$ per m Cored"] ?? 0,
        notes: "Seeded from perfiles_master.xlsx",
      },
    });

    // PieceAlias: original SA####_ type
    if (typeRaw && typeRaw !== canonicalName) {
      const rawNorm = normalizeAliasRaw(typeRaw);
      await prisma.pieceAlias.upsert({
        where: { aliasNormalized_pieceId: { aliasNormalized: rawNorm, pieceId: piece.id } },
        update: {},
        create: {
          pieceId: piece.id,
          aliasRaw: typeRaw,
          aliasNormalized: rawNorm,
          source: "EXCEL_IMPORT",
        },
      });
    }
    // PieceAlias: canonical form
    const canonNorm = normalizeAliasRaw(canonicalName);
    await prisma.pieceAlias.upsert({
      where: { aliasNormalized_pieceId: { aliasNormalized: canonNorm, pieceId: piece.id } },
      update: {},
      create: {
        pieceId: piece.id,
        aliasRaw: canonicalName,
        aliasNormalized: canonNorm,
        source: "EXCEL_IMPORT",
      },
    });
  }
  console.log("✅ PieceCatalog, PieceCost, PieceAlias seeded");

  // ── 5. Warehouses ────────────────────────────────────────────────────────
  const wh = await prisma.warehouse.upsert({
    where: { id: "seed-warehouse-main" },
    update: {},
    create: {
      id: "seed-warehouse-main",
      orgId: org.id,
      name: "Main Warehouse (Canada)",
      location: "Canada",
      isActive: true,
    },
  });
  console.log("✅ Warehouse created:", wh.name);

  // ── 6. Countries ─────────────────────────────────────────────────────────
  const countries = [
    { code: "PA", name: "Panama" },
    { code: "AR", name: "Argentina" },
    { code: "CR", name: "Costa Rica" },
    { code: "CO", name: "Colombia" },
    { code: "SV", name: "El Salvador" },
    { code: "HN", name: "Honduras" },
  ];

  const countryMap: Record<string, string> = {};
  for (const c of countries) {
    const cp = await prisma.countryProfile.upsert({
      where: { orgId_code: { orgId: org.id, code: c.code } },
      update: {},
      create: { orgId: org.id, code: c.code, name: c.name, isActive: true },
    });
    countryMap[c.code] = cp.id;
  }
  console.log("✅ CountryProfiles created");

  // ── 7. FreightRateProfiles ────────────────────────────────────────────────
  const freightData = [
    { code: "PA", name: "Panama Standard Freight", freightPerContainer: 3500 },
    { code: "AR", name: "Argentina Standard Freight", freightPerContainer: 5500 },
    { code: "CR", name: "Costa Rica Standard Freight", freightPerContainer: 3800 },
    { code: "CO", name: "Colombia Standard Freight", freightPerContainer: 4200 },
    { code: "SV", name: "El Salvador Standard Freight", freightPerContainer: 3600 },
    { code: "HN", name: "Honduras Standard Freight", freightPerContainer: 3700 },
  ];

  for (const f of freightData) {
    await prisma.freightRateProfile.upsert({
      where: { id: `seed-freight-${f.code}` },
      update: { freightPerContainer: f.freightPerContainer },
      create: {
        id: `seed-freight-${f.code}`,
        orgId: org.id,
        countryId: countryMap[f.code],
        name: f.name,
        freightPerContainer: f.freightPerContainer,
        isDefault: true,
      },
    });
  }
  console.log("✅ FreightRateProfiles created");

  // ── 8. TaxRuleSets (PA, AR) ───────────────────────────────────────────────
  // Panama
  await prisma.taxRuleSet.upsert({
    where: { id: "seed-tax-PA" },
    update: {},
    create: {
      id: "seed-tax-PA",
      orgId: org.id,
      countryId: countryMap["PA"],
      name: "Panama DDP Rules",
      isActive: true,
      rules: [
        { order: 1, label: "ITBMS (7% of CIF)", base: "CIF", ratePct: 7, perContainer: false },
        { order: 2, label: "Customs Broker", base: "FIXED_PER_CONTAINER", fixedAmount: 250, perContainer: true },
        { order: 3, label: "Inland Transport", base: "FIXED_TOTAL", fixedAmount: 1000, perContainer: false },
      ],
    },
  });

  // Argentina
  await prisma.taxRuleSet.upsert({
    where: { id: "seed-tax-AR" },
    update: {},
    create: {
      id: "seed-tax-AR",
      orgId: org.id,
      countryId: countryMap["AR"],
      name: "Argentina DDP Rules",
      isActive: true,
      rules: [
        { order: 1, label: "Duty (18% of CIF)", base: "CIF", ratePct: 18, perContainer: false },
        { order: 2, label: "Statistic (2.5% of CIF)", base: "CIF", ratePct: 2.5, perContainer: false },
        {
          order: 3,
          label: "VAT (21% of BASE_IMPONIBLE)",
          base: "BASE_IMPONIBLE",
          ratePct: 21,
          perContainer: false,
          note: "BASE_IMPONIBLE = CIF + Duty + Statistic",
        },
        {
          order: 4,
          label: "VAT Additional (20% of BASE_IMPONIBLE)",
          base: "BASE_IMPONIBLE",
          ratePct: 20,
          perContainer: false,
        },
        {
          order: 5,
          label: "Income Advance (6% of BASE_IMPONIBLE)",
          base: "BASE_IMPONIBLE",
          ratePct: 6,
          perContainer: false,
        },
        {
          order: 6,
          label: "Gross Income (3% of BASE_IMPONIBLE)",
          base: "BASE_IMPONIBLE",
          ratePct: 3,
          perContainer: false,
        },
        { order: 7, label: "Customs Broker (per container)", base: "FIXED_PER_CONTAINER", fixedAmount: 725, perContainer: true },
        {
          order: 8,
          label: "Local Margin VBT Argentina (per container)",
          base: "FIXED_PER_CONTAINER",
          fixedAmount: 5000,
          perContainer: true,
        },
      ],
    },
  });
  console.log("✅ TaxRuleSets created for PA and AR");

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
