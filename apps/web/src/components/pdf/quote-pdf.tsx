import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import {
  deriveFclContainersFromWallM2,
  DEFAULT_WALL_M2_S80,
  DEFAULT_WALL_M2_S150,
  DEFAULT_WALL_M2_S200,
} from "@vbt/core";
import { getT } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";
import { PDF_BRAND as C } from "./pdf-brand";

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 32,
    paddingBottom: 48,
    paddingLeft: 38,
    paddingRight: 38,
    color: C.textDark,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: C.accent,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 42,
    height: 48,
    objectFit: "contain",
    marginRight: 10,
  },
  brandText: {
    flexShrink: 1,
  },
  brandName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.navyDark,
    letterSpacing: 0.3,
  },
  companyTagline: {
    fontSize: 7.5,
    color: C.textMid,
    marginTop: 2,
    maxWidth: 220,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  quoteTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.navyDark,
    letterSpacing: 1.2,
  },
  quoteNumber: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.accent,
    marginTop: 3,
  },
  quoteMeta: {
    fontSize: 7.5,
    color: C.textMid,
    marginTop: 2,
  },
  statusPill: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    backgroundColor: C.navyDark,
    color: C.white,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    marginTop: 5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  section: {
    marginBottom: 9,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.navyDark,
    paddingBottom: 3,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.navyLight,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: "42%",
    color: C.textMid,
    fontSize: 8.5,
  },
  value: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: C.textDark,
  },
  metaGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: C.grayBorder,
    borderRadius: 3,
    overflow: "hidden",
  },
  metaCol: {
    flex: 1,
    padding: 6,
  },
  metaColDivider: {
    borderLeftWidth: 1,
    borderLeftColor: C.grayBorder,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  infoBox: {
    width: "48.5%",
    backgroundColor: C.grayBg,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 3,
    borderLeftWidth: 2.5,
    borderLeftColor: C.navyMid,
  },
  infoBoxAccent: {
    borderLeftColor: C.accent,
    backgroundColor: C.navyLight,
  },
  infoBoxLabel: {
    fontSize: 6.5,
    color: C.textMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  infoBoxValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.navyDark,
  },
  sectionNote: {
    fontSize: 7,
    color: C.textMuted,
    marginBottom: 4,
    fontStyle: "italic",
  },
  table: {
    width: "100%",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.grayBorder,
    borderRadius: 3,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.navyDark,
    color: C.white,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grayBorder,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grayBorder,
    backgroundColor: C.grayBg,
  },
  colDesc: { flex: 3 },
  colSys: { width: 40, textAlign: "center" },
  colQty: { width: 35, textAlign: "right" },
  colLength: { width: 50, textAlign: "right" },
  colM2: { width: 45, textAlign: "right" },
  colPrice: { width: 55, textAlign: "right" },
  colTotal: { width: 65, textAlign: "right" },
  panel: {
    backgroundColor: C.grayBg,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.grayBorder,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  summaryLabel: {
    color: C.textMid,
    fontSize: 8,
    flex: 1,
    paddingRight: 8,
  },
  summaryValueCol: {
    alignItems: "flex-end",
    maxWidth: "55%",
  },
  summaryValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: C.textDark,
  },
  summaryValueSecondary: {
    fontSize: 6.5,
    color: C.textMid,
    marginTop: 0.5,
  },
  taxLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2.5,
    paddingLeft: 2,
  },
  totalBanner: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: C.navyMid,
  },
  totalBannerInner: {
    backgroundColor: C.navyDark,
    borderRadius: 3,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  totalBannerLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.navyLight,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  totalBannerAmount: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  totalBannerUnits: {
    fontSize: 7,
    color: C.navyLight,
    marginTop: 3,
    lineHeight: 1.3,
  },
  alertBox: {
    backgroundColor: C.navyLight,
    borderLeftWidth: 2.5,
    borderLeftColor: C.navyMid,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  alertText: {
    fontSize: 8,
    color: C.navyDark,
  },
  notesBox: {
    backgroundColor: C.grayBg,
    padding: 8,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.grayBorder,
  },
  notesText: {
    fontSize: 8.5,
    color: C.textMid,
    lineHeight: 1.4,
  },
  disclaimerBox: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.navyLight,
  },
  disclaimerTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.navyDark,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  disclaimerText: {
    fontSize: 7,
    color: C.textMuted,
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 38,
    right: 38,
    borderTopWidth: 1,
    borderTopColor: C.grayBorder,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 6.5,
    color: C.textMuted,
  },
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuotePdfData {
  quoteNumber: string;
  status: string;
  createdAt: string;
  sentAt?: string;
  project: {
    name: string;
    client?: string;
    location?: string;
  };
  country?: {
    name: string;
    code: string;
  };
  costMethod: string;
  baseUom: string;
  lines: Array<{
    description: string;
    systemCode?: string;
    qty: number;
    heightMm?: number;
    linearM?: number;
    m2Line?: number;
    unitPrice: number;
    markupPct: number;
    lineTotalWithMarkup: number;
    isBelowMinRun?: boolean;
    isIgnored?: boolean;
  }>;
  wallAreaM2S80: number;
  wallAreaM2S150: number;
  wallAreaM2S200: number;
  wallAreaM2Total: number;
  totalWeightKgCored?: number;
  totalVolumeM3?: number;
  factoryCostUsd: number;
  basePriceForPartner?: number;
  commissionPct: number;
  commissionFixed: number;
  commissionAmount: number;
  fobUsd: number;
  freightCostUsd: number;
  numContainers: number;
  kitsPerContainer: number;
  totalKits: number;
  cifUsd: number;
  taxLines: Array<{
    label: string;
    computedAmount: number;
  }>;
  taxesFeesUsd: number;
  /** Technical service included in taxesFeesUsd but not in rule taxLines. */
  technicalServiceUsd?: number;
  landedDdpUsd: number;
  concreteM3: number;
  steelKgEst: number;
  notes?: string;
  quotedByName?: string;
  logoDataUrl?: string | null;
}

export interface QuotePdfOptions {
  includeAlerts?: boolean;
  includeMaterialLines?: boolean;
  showUnitPrice?: boolean;
  locale?: Locale;
}

export type PriceDisplayMode = "kit_and_container" | "container_and_total" | "container_only";

export function resolvePriceDisplayMode(
  numContainers: number,
  kitsPerContainer: number,
  totalKits: number
): PriceDisplayMode {
  const nContRaw = Number(numContainers);
  const nCont = Number.isFinite(nContRaw) && nContRaw >= 1 ? Math.floor(nContRaw) : 1;
  const kpcRaw = Number(kitsPerContainer);
  const kpc = Number.isFinite(kpcRaw) ? kpcRaw : 0;
  const kitsRaw = Number(totalKits);
  const kits = Number.isFinite(kitsRaw) && kitsRaw > 0 ? Math.floor(kitsRaw) : 0;

  // One kit spanning multiple containers
  if (kits <= 1 && nCont > 1) return "container_and_total";
  if (kpc > 0 && kpc < 1 && nCont > 1) return "container_and_total";

  // More than one kit per container
  if (kpc > 1) return "kit_and_container";
  if (kits > nCont && nCont >= 1) return "kit_and_container";

  return "container_only";
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);

const fmtN = (n: number, d = 1) => n.toFixed(d);
const safeFmt = (n: unknown) => fmt(Number(n) || 0);
const safeFmtN = (n: unknown, d = 1) => fmtN(Number(n) || 0, d);

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function UnitBreakdown({
  amount,
  mode,
  numCont,
  totalKits,
  t,
  emphasize,
  compact,
}: {
  amount: number;
  mode: PriceDisplayMode;
  numCont: number;
  totalKits: number;
  t: TFn;
  emphasize?: boolean;
  /** Single primary unit only (for long tax line lists). */
  compact?: boolean;
}) {
  const total = Number(amount) || 0;
  const perCont = total / Math.max(numCont, 1);
  const perKit = total / Math.max(totalKits, 1);

  if (mode === "kit_and_container") {
    if (compact) {
      return (
        <View style={styles.summaryValueCol}>
          <Text style={[styles.summaryValue, emphasize ? { fontSize: 9.5 } : {}]}>
            {fmt(perKit)}
            {t("pdf.quote.perKit")}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.summaryValueCol}>
        <Text style={[styles.summaryValue, emphasize ? { fontSize: 10 } : {}]}>
          {fmt(perKit)}
          {t("pdf.quote.perKit")}
        </Text>
        <Text style={styles.summaryValueSecondary}>
          {fmt(perCont)}
          {t("pdf.quote.perContainer")}
        </Text>
      </View>
    );
  }

  if (mode === "container_and_total") {
    if (compact) {
      return (
        <View style={styles.summaryValueCol}>
          <Text style={[styles.summaryValue, emphasize ? { fontSize: 9.5 } : {}]}>
            {fmt(perCont)}
            {t("pdf.quote.perContainer")}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.summaryValueCol}>
        <Text style={[styles.summaryValue, emphasize ? { fontSize: 10 } : {}]}>
          {fmt(perCont)}
          {t("pdf.quote.perContainer")}
        </Text>
        <Text style={styles.summaryValueSecondary}>
          {fmt(total)} {t("pdf.quote.shipmentTotal")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.summaryValueCol}>
      <Text style={[styles.summaryValue, emphasize ? { fontSize: 10 } : {}]}>
        {fmt(perCont)}
        {t("pdf.quote.perContainer")}
      </Text>
      {!compact && numCont > 1 ? (
        <Text style={styles.summaryValueSecondary}>
          {fmt(total)} {t("pdf.quote.shipmentTotal")}
        </Text>
      ) : null}
    </View>
  );
}

function MoneyRow({
  label,
  amount,
  mode,
  numCont,
  totalKits,
  t,
  bold,
}: {
  label: string;
  amount: number;
  mode: PriceDisplayMode;
  numCont: number;
  totalKits: number;
  t: TFn;
  bold?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          bold ? { fontFamily: "Helvetica-Bold", color: C.textDark } : {},
        ]}
      >
        {label}
      </Text>
      <UnitBreakdown
        amount={amount}
        mode={mode}
        numCont={numCont}
        totalKits={totalKits}
        t={t}
        emphasize={bold}
      />
    </View>
  );
}

function SumPlain({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          bold ? { fontFamily: "Helvetica-Bold", color: C.textDark } : {},
        ]}
      >
        {label}
      </Text>
      <Text style={[styles.summaryValue, bold ? { fontSize: 10 } : {}]}>{value}</Text>
    </View>
  );
}

function ddpUnitLine(
  mode: PriceDisplayMode,
  landed: number,
  numCont: number,
  totalKits: number,
  kitsPerContainer: number,
  t: TFn
): string {
  const perCont = landed / Math.max(numCont, 1);
  const perKit = landed / Math.max(totalKits, 1);
  const kitInfo =
    totalKits > 0
      ? `${totalKits} ${totalKits === 1 ? t("pdf.quote.kitLabel") : t("pdf.quote.kitsLabel")}${
          kitsPerContainer > 0 ? ` · ${kitsPerContainer}${t("pdf.quote.perContainer")}` : ""
        }`
      : `${numCont} ${numCont === 1 ? t("pdf.quote.containersLabel") : t("pdf.quote.containersLabelPlural")}`;

  if (mode === "kit_and_container") {
    return `${kitInfo}\n${fmt(perKit)}${t("pdf.quote.perKit")}  ·  ${fmt(perCont)}${t("pdf.quote.perContainer")}`;
  }
  if (mode === "container_and_total") {
    return `${kitInfo}\n${fmt(perCont)}${t("pdf.quote.perContainer")}  ·  ${fmt(landed)} ${t("pdf.quote.shipmentTotal")}`;
  }
  return `${kitInfo}\n${fmt(perCont)}${t("pdf.quote.perContainer")}${
    numCont > 1 ? `  ·  ${fmt(landed)} ${t("pdf.quote.shipmentTotal")}` : ""
  }`;
}

const DEFAULT_CONTAINER_VOLUME_M3 = 70;

export function QuotePdfDocument({
  data,
  options = {},
}: {
  data: QuotePdfData;
  options?: QuotePdfOptions;
}) {
  const locale: Locale = options?.locale === "es" ? "es" : "en";
  const t = getT(locale);
  const hasCsvLines = data.costMethod === "CSV" && data.lines.length > 0;
  const belowMinRunLines = data.lines.filter((l) => l.isBelowMinRun);
  const includeAlerts = options.includeAlerts ?? false;
  const includeMaterialLines = options.includeMaterialLines ?? true;
  const showUnitPrice = options.showUnitPrice ?? true;

  const numCont = Math.max(Number(data.numContainers) || 1, 1);
  const kitsPerContainer = Number(data.kitsPerContainer) || 0;
  const totalVol = Number(data.totalVolumeM3) || 0;
  const totalKits = Math.max(0, Math.floor(Number(data.totalKits) || 0));
  const priceMode = resolvePriceDisplayMode(numCont, kitsPerContainer, totalKits);
  const taxLines = Array.isArray(data.taxLines) ? data.taxLines : [];
  const technicalServiceUsd = Math.max(0, Number(data.technicalServiceUsd) || 0);
  const showTaxesSection = taxLines.length > 0 || technicalServiceUsd > 0;

  const wallFcl = deriveFclContainersFromWallM2({
    m2S80: Number(data.wallAreaM2S80) || 0,
    m2S150: Number(data.wallAreaM2S150) || 0,
    m2S200: Number(data.wallAreaM2S200) || 0,
    areaM2PerContainerS80: DEFAULT_WALL_M2_S80,
    areaM2PerContainerS150: DEFAULT_WALL_M2_S150,
    areaM2PerContainerS200: DEFAULT_WALL_M2_S200,
    totalKits: totalKits > 0 ? totalKits : 1,
  });
  const hasWallM2 =
    (Number(data.wallAreaM2S80) || 0) > 0 ||
    (Number(data.wallAreaM2S150) || 0) > 0 ||
    (Number(data.wallAreaM2S200) || 0) > 0;
  const occupancyPerKitPct = hasWallM2 ? wallFcl.occupancyPerKitPct : null;
  const occupancyTotalPct = hasWallM2
    ? numCont > 0 && (wallFcl.totalSlots ?? 0) > 0
      ? ((wallFcl.totalSlots ?? 0) / numCont) * 100
      : wallFcl.occupancyTotalPct
    : null;
  const occupancyVolPct =
    totalVol > 0 ? Math.min(100, (totalVol / (numCont * DEFAULT_CONTAINER_VOLUME_M3)) * 100) : null;

  const containersLabel =
    kitsPerContainer > 0
      ? `${data.numContainers} × ${kitsPerContainer} ${t("pdf.quote.kitsPerContainer")}`
      : `${data.numContainers}`;

  const destLabel = data.country
    ? `${data.country.name} (${data.country.code})`
    : t("pdf.quote.destinationFallback");

  const showLogistics =
    occupancyPerKitPct != null ||
    occupancyTotalPct != null ||
    (!hasWallM2 && occupancyVolPct != null) ||
    priceMode === "kit_and_container" ||
    priceMode === "container_and_total";

  return (
    <Document
      title={`${t("pdf.quote.quoteTitle")} ${data.quoteNumber}`}
      author="Vision Building Technologies"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {data.logoDataUrl ? <Image src={data.logoDataUrl} style={styles.logo} /> : null}
            <View style={styles.brandText}>
              <Text style={styles.brandName}>Vision Building Technologies</Text>
              <Text style={styles.companyTagline}>{t("pdf.quote.companyTagline")}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.quoteTitle}>{t("pdf.quote.quoteTitle")}</Text>
            <Text style={styles.quoteNumber}>{data.quoteNumber}</Text>
            <Text style={styles.statusPill}>{data.status}</Text>
            {data.quotedByName ? (
              <Text style={styles.quoteMeta}>
                {t("pdf.quote.quotedBy")} {data.quotedByName}
              </Text>
            ) : null}
            <Text style={styles.quoteMeta}>{data.createdAt}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("pdf.quote.sectionProjectClient")}</Text>
          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <InfoRow label={t("pdf.quote.project")} value={data.project.name} />
              {data.project.client ? (
                <InfoRow label={t("pdf.quote.client")} value={data.project.client} />
              ) : null}
              {data.project.location ? (
                <InfoRow label={t("pdf.quote.location")} value={data.project.location} />
              ) : null}
            </View>
            <View style={[styles.metaCol, styles.metaColDivider]}>
              <InfoRow label={t("pdf.quote.destination")} value={destLabel} />
              <InfoRow label={t("pdf.quote.costMethod")} value={data.costMethod} />
              <InfoRow label={t("pdf.quote.baseUom")} value={data.baseUom} />
              <InfoRow label={t("pdf.quote.containers")} value={containersLabel} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("pdf.quote.sectionWallArea")}</Text>
          <Text style={styles.sectionNote}>{t("pdf.quote.wallAreaPerKitNote")}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>{t("pdf.quote.s80")}</Text>
              <Text style={styles.infoBoxValue}>{safeFmtN(data.wallAreaM2S80)} m²</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>{t("pdf.quote.s150")}</Text>
              <Text style={styles.infoBoxValue}>{safeFmtN(data.wallAreaM2S150)} m²</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>{t("pdf.quote.s200")}</Text>
              <Text style={styles.infoBoxValue}>{safeFmtN(data.wallAreaM2S200)} m²</Text>
            </View>
            <View style={[styles.infoBox, styles.infoBoxAccent]}>
              <Text style={styles.infoBoxLabel}>{t("pdf.quote.totalWallArea")}</Text>
              <Text style={styles.infoBoxValue}>{safeFmtN(data.wallAreaM2Total)} m²</Text>
            </View>
          </View>
        </View>

        {includeAlerts && belowMinRunLines.length > 0 ? (
          <View style={styles.section}>
            {belowMinRunLines.map((line, i) => (
              <View key={i} style={styles.alertBox}>
                <Text style={styles.alertText}>
                  {t("pdf.quote.belowMinRun")} {line.description} - {t("pdf.quote.markupApplied")}{" "}
                  {line.markupPct ?? 0}%
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {includeMaterialLines && hasCsvLines ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("pdf.quote.sectionMaterialLines")}</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colDesc}>{t("pdf.quote.description")}</Text>
                <Text style={styles.colSys}>{t("pdf.quote.sys")}</Text>
                <Text style={styles.colQty}>{t("pdf.quote.qty")}</Text>
                <Text style={styles.colLength}>{t("pdf.quote.lengthM")}</Text>
                <Text style={styles.colM2}>m²</Text>
                {showUnitPrice ? <Text style={styles.colPrice}>{t("pdf.quote.unit")}</Text> : null}
                <Text style={styles.colTotal}>{t("pdf.quote.total")}</Text>
              </View>
              {data.lines
                .filter((l) => !l.isIgnored)
                .map((line, i) => (
                  <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={styles.colDesc}>{line.description}</Text>
                    <Text style={styles.colSys}>{line.systemCode ?? "—"}</Text>
                    <Text style={styles.colQty}>{safeFmtN(line.qty, 0)}</Text>
                    <Text style={styles.colLength}>{safeFmtN((line.heightMm ?? 0) / 1000)}</Text>
                    <Text style={styles.colM2}>{safeFmtN(line.m2Line ?? 0)}</Text>
                    {showUnitPrice ? (
                      <Text style={styles.colPrice}>{safeFmt(line.unitPrice)}</Text>
                    ) : null}
                    <Text style={styles.colTotal}>{safeFmt(line.lineTotalWithMarkup)}</Text>
                  </View>
                ))}
            </View>
          </View>
        ) : null}

        {showLogistics ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("pdf.quote.sectionLogistics")}</Text>
            <View style={styles.panel}>
              {occupancyPerKitPct != null ? (
                <SumPlain
                  label={t("pdf.quote.containerOccupancyPerKit")}
                  value={`${safeFmtN(occupancyPerKitPct, 1)}%`}
                />
              ) : null}
              {occupancyTotalPct != null ? (
                <SumPlain
                  label={t("pdf.quote.containerOccupancyTotal")}
                  value={`${safeFmtN(occupancyTotalPct, 1)}%`}
                />
              ) : null}
              {!hasWallM2 && occupancyVolPct != null ? (
                <SumPlain
                  label={t("pdf.quote.containerOccupancy")}
                  value={`${safeFmtN(occupancyVolPct, 1)}%`}
                />
              ) : null}
              {priceMode === "kit_and_container" ? (
                <Text style={[styles.sectionNote, { marginBottom: 0, marginTop: 4 }]}>
                  {t("pdf.quote.priceModeKitContainerNote")}
                </Text>
              ) : null}
              {priceMode === "container_and_total" ? (
                <Text style={[styles.sectionNote, { marginBottom: 0, marginTop: 4 }]}>
                  {t("pdf.quote.priceModeContainerTotalNote")}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {showTaxesSection ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("pdf.quote.sectionTaxesFees")} ({destLabel})
            </Text>
            <View style={styles.panel}>
              {taxLines.map((tl, i) => (
                <View key={i} style={styles.taxLine}>
                  <Text style={styles.summaryLabel}>{tl.label}</Text>
                  <UnitBreakdown
                    amount={Number(tl.computedAmount) || 0}
                    mode={priceMode}
                    numCont={numCont}
                    totalKits={totalKits || 1}
                    t={t}
                    compact
                  />
                </View>
              ))}
              {technicalServiceUsd > 0 ? (
                <View style={styles.taxLine}>
                  <Text style={styles.summaryLabel}>{t("pdf.quote.technicalService")}</Text>
                  <UnitBreakdown
                    amount={technicalServiceUsd}
                    mode={priceMode}
                    numCont={numCont}
                    totalKits={totalKits || 1}
                    t={t}
                    compact
                  />
                </View>
              ) : null}
              <View
                style={{
                  marginTop: 4,
                  paddingTop: 4,
                  borderTopWidth: 1,
                  borderTopColor: C.grayBorder,
                }}
              >
                <MoneyRow
                  label={t("pdf.quote.totalTaxesFeesLabel")}
                  amount={Number(data.taxesFeesUsd) || 0}
                  mode={priceMode}
                  numCont={numCont}
                  totalKits={totalKits || 1}
                  t={t}
                  bold
                />
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{t("pdf.quote.sectionFinancial")}</Text>
          <View style={styles.panel}>
            <MoneyRow
              label="FOB"
              amount={Number(data.fobUsd) || 0}
              mode={priceMode}
              numCont={numCont}
              totalKits={totalKits || 1}
              t={t}
              bold
            />
            <MoneyRow
              label={`${t("pdf.quote.freight")} (${data.numContainers} ${
                Number(data.numContainers) !== 1
                  ? t("pdf.quote.containersLabelPlural")
                  : t("pdf.quote.containersLabel")
              })`}
              amount={Number(data.freightCostUsd) || 0}
              mode={priceMode}
              numCont={numCont}
              totalKits={totalKits || 1}
              t={t}
            />
            <MoneyRow
              label="CIF"
              amount={Number(data.cifUsd) || 0}
              mode={priceMode}
              numCont={numCont}
              totalKits={totalKits || 1}
              t={t}
              bold
            />
            <MoneyRow
              label={t("pdf.quote.totalTaxesFees")}
              amount={Number(data.taxesFeesUsd) || 0}
              mode={priceMode}
              numCont={numCont}
              totalKits={totalKits || 1}
              t={t}
            />

            <View style={styles.totalBanner}>
              <View style={styles.totalBannerInner}>
                <Text style={styles.totalBannerLabel}>{t("pdf.quote.landedDdpTotal")}</Text>
                <Text style={styles.totalBannerAmount}>{safeFmt(data.landedDdpUsd)}</Text>
                <Text style={styles.totalBannerUnits}>
                  {ddpUnitLine(
                    priceMode,
                    Number(data.landedDdpUsd) || 0,
                    numCont,
                    totalKits,
                    kitsPerContainer,
                    t
                  )}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View wrap={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("pdf.quote.sectionInformational")}</Text>
            {(() => {
              const tk = Math.max(Number(data.totalKits) || 1, 1);
              const m2PerKit = Number(data.wallAreaM2Total) || 0;
              const m3PerKit = Number(data.concreteM3) || 0;
              const kgPerKit = Number(data.steelKgEst) || 0;
              const m2Total = m2PerKit * tk;
              const m3Total = m3PerKit * tk;
              const kgTotal = kgPerKit * tk;
              return (
                <View style={styles.panel}>
                  <SumPlain
                    label={t("pdf.quote.wallsM2")}
                    value={
                      tk > 1
                        ? `${t("pdf.quote.perKitLabel")} ${safeFmtN(m2PerKit)} · ${t("pdf.quote.totalLabel")} ${safeFmtN(m2Total)} m²`
                        : `${t("pdf.quote.totalLabel")} ${safeFmtN(m2Total)} m²`
                    }
                  />
                  <SumPlain
                    label={t("pdf.quote.concreteM3")}
                    value={
                      tk > 1
                        ? `${t("pdf.quote.perKitLabel")} ${safeFmtN(m3PerKit)} · ${t("pdf.quote.totalLabel")} ${safeFmtN(m3Total)} m³`
                        : `${t("pdf.quote.totalLabel")} ${safeFmtN(m3Total)} m³`
                    }
                  />
                  <SumPlain
                    label={t("pdf.quote.steelKg")}
                    value={
                      tk > 1
                        ? `${t("pdf.quote.perKitLabel")} ${safeFmtN(kgPerKit, 1)} · ${t("pdf.quote.totalLabel")} ${safeFmtN(kgTotal, 1)} kg`
                        : `${t("pdf.quote.totalLabel")} ${safeFmtN(kgTotal, 1)} kg`
                    }
                  />
                  {data.totalWeightKgCored != null ? (
                    <SumPlain
                      label={t("pdf.quote.panelWeightCored")}
                      value={`${safeFmtN(data.totalWeightKgCored)} kg`}
                    />
                  ) : null}
                  {data.totalVolumeM3 != null && Number(data.totalVolumeM3) > 0 ? (
                    <SumPlain
                      label={t("pdf.quote.panelVolume")}
                      value={`${safeFmtN(data.totalVolumeM3, 2)} m³`}
                    />
                  ) : null}
                </View>
              );
            })()}
          </View>

          {data.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("pdf.quote.sectionNotes")}</Text>
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{data.notes}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerTitle}>{t("pdf.quote.disclaimerTitle")}</Text>
            <Text style={styles.disclaimerText}>{t("pdf.quote.disclaimerBody")}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{t("pdf.quote.footerConfidential")}</Text>
          <Text style={styles.footerText}>
            {t("pdf.quote.generated")}{" "}
            {new Date().toLocaleDateString(locale === "es" ? "es-ES" : "en-US")} · {data.quoteNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
