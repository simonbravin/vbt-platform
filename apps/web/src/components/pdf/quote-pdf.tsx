import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { getT } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 60,
    paddingLeft: 40,
    paddingRight: 40,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottom: "2px solid #1a3a5c",
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  companyName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1a3a5c",
  },
  companyTagline: {
    fontSize: 8,
    color: "#666",
    marginTop: 2,
  },
  quoteTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#e87722",
  },
  quoteNumber: {
    fontSize: 10,
    color: "#555",
    marginTop: 2,
  },
  quoteStatus: {
    fontSize: 8,
    backgroundColor: "#1a3a5c",
    color: "white",
    padding: "3 8",
    borderRadius: 4,
    marginTop: 4,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a3a5c",
    borderBottom: "1px solid #e0e0e0",
    paddingBottom: 3,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: "40%",
    color: "#555",
  },
  value: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  // Table
  table: {
    width: "100%",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a3a5c",
    color: "white",
    padding: "4 6",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    padding: "3 6",
    borderBottom: "0.5px solid #e8e8e8",
  },
  tableRowAlt: {
    flexDirection: "row",
    padding: "3 6",
    borderBottom: "0.5px solid #e8e8e8",
    backgroundColor: "#f8f9fa",
  },
  colDesc: { flex: 3 },
  colSys: { width: 40, textAlign: "center" },
  colQty: { width: 35, textAlign: "right" },
  colLength: { width: 50, textAlign: "right" },
  colM2: { width: 45, textAlign: "right" },
  colPrice: { width: 55, textAlign: "right" },
  colTotal: { width: 65, textAlign: "right" },
  // Summary box
  summaryBox: {
    backgroundColor: "#f0f4f8",
    padding: 12,
    borderRadius: 4,
    borderLeft: "3px solid #1a3a5c",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryLabel: {
    color: "#555",
    fontSize: 9,
  },
  summaryValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTop: "1.5px solid #1a3a5c",
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a3a5c",
  },
  totalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#e87722",
  },
  // Tax lines
  taxLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    paddingLeft: 8,
  },
  // Info grid
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  infoBox: {
    width: "48%",
    backgroundColor: "#f8f9fa",
    padding: 8,
    borderRadius: 4,
    borderLeft: "2px solid #e87722",
  },
  infoBoxLabel: {
    fontSize: 7,
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  infoBoxValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a3a5c",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1px solid #e0e0e0",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#999",
  },
  // Alert
  alertBox: {
    backgroundColor: "#fff3cd",
    borderLeft: "3px solid #f59e0b",
    padding: "4 8",
    marginBottom: 4,
    flexDirection: "row",
  },
  alertText: {
    fontSize: 8,
    color: "#92400e",
  },
  // Notes
  notesBox: {
    backgroundColor: "#f8f9fa",
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  notesText: {
    fontSize: 9,
    color: "#555",
    lineHeight: 1.4,
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
  // Snapshot data
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
  // Wall areas
  wallAreaM2S80: number;
  wallAreaM2S150: number;
  wallAreaM2S200: number;
  wallAreaM2Total: number;
  totalWeightKgCored?: number;
  totalVolumeM3?: number;
  // Financials (partners never see factory cost; they see basePriceForPartner = factory + Vision Latam %)
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
  landedDdpUsd: number;
  // Informational
  concreteM3: number;
  steelKgEst: number;
  notes?: string;
  quotedByName?: string;
}

export interface QuotePdfOptions {
  includeAlerts?: boolean;
  includeMaterialLines?: boolean;
  showUnitPrice?: boolean;
  /** Locale for PDF labels (en/es). Defaults to "en". */
  locale?: Locale;
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

// ─── Components ──────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function SumRow({
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
      <Text style={[styles.summaryLabel, bold ? { fontFamily: "Helvetica-Bold" } : {}]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, bold ? { fontSize: 10 } : {}]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Main PDF Document ────────────────────────────────────────────────────────

const DEFAULT_CONTAINER_VOLUME_M3 = 70;

export function QuotePdfDocument({ data, options = {} }: { data: QuotePdfData; options?: QuotePdfOptions }) {
  const locale: Locale = options?.locale === "es" ? "es" : "en";
  const t = getT(locale);
  const hasCsvLines = data.costMethod === "CSV" && data.lines.length > 0;
  const belowMinRunLines = data.lines.filter((l) => l.isBelowMinRun);
  const includeAlerts = options.includeAlerts ?? false;
  const includeMaterialLines = options.includeMaterialLines ?? true;
  const showUnitPrice = options.showUnitPrice ?? true;
  const numCont = Math.max(Number(data.numContainers) || 1, 1);
  const totalVol = Number(data.totalVolumeM3) ?? 0;
  const occupancyPct = totalVol > 0 ? Math.min(100, (totalVol / (numCont * DEFAULT_CONTAINER_VOLUME_M3)) * 100) : null;

  return (
    <Document
      title={`${t("pdf.quote.quoteTitle")} ${data.quoteNumber}`}
      author="Vision Building Technologies"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>Vision Building Technologies</Text>
            <Text style={styles.companyTagline}>{t("pdf.quote.companyTagline")}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.quoteTitle}>{t("pdf.quote.quoteTitle")}</Text>
            <Text style={styles.quoteNumber}>{data.quoteNumber}</Text>
            <Text style={styles.quoteStatus}>{data.status}</Text>
            {data.quotedByName && (
              <Text style={{ fontSize: 7, color: "#666", marginTop: 2 }}>
                {t("pdf.quote.quotedBy")} {data.quotedByName}
              </Text>
            )}
            <Text style={{ fontSize: 7, color: "#888", marginTop: 4 }}>
              {data.createdAt}
            </Text>
          </View>
        </View>

        {/* ── Project Info ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("pdf.quote.sectionProjectClient")}</Text>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <InfoRow label={t("pdf.quote.project")} value={data.project.name} />
              {data.project.client && (
                <InfoRow label={t("pdf.quote.client")} value={data.project.client} />
              )}
              {data.project.location && (
                <InfoRow label={t("pdf.quote.location")} value={data.project.location} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              {data.country && (
                <InfoRow
                  label={t("pdf.quote.destination")}
                  value={`${data.country.name} (${data.country.code})`}
                />
              )}
              <InfoRow label={t("pdf.quote.costMethod")} value={data.costMethod} />
              <InfoRow label={t("pdf.quote.baseUom")} value={data.baseUom} />
              <InfoRow
                label={t("pdf.quote.containers")}
                value={`${data.numContainers} × ${data.kitsPerContainer} kits`}
              />
            </View>
          </View>
        </View>

        {/* ── Wall Area Summary ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("pdf.quote.sectionWallArea")}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>{t("pdf.quote.s80")}</Text>
              <Text style={styles.infoBoxValue}>
                {safeFmtN(data.wallAreaM2S80)} m²
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>{t("pdf.quote.s150")}</Text>
              <Text style={styles.infoBoxValue}>
                {safeFmtN(data.wallAreaM2S150)} m²
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>{t("pdf.quote.s200")}</Text>
              <Text style={styles.infoBoxValue}>
                {safeFmtN(data.wallAreaM2S200)} m²
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>{t("pdf.quote.totalWallArea")}</Text>
              <Text style={styles.infoBoxValue}>
                {safeFmtN(data.wallAreaM2Total)} m²
              </Text>
            </View>
          </View>
        </View>

        {/* ── Alerts (optional) ─────────────────────────────────────────── */}
        {includeAlerts && belowMinRunLines.length > 0 && (
          <View style={styles.section}>
            {belowMinRunLines.map((line, i) => (
              <View key={i} style={styles.alertBox}>
                <Text style={styles.alertText}>
                  ⚠ {t("pdf.quote.belowMinRun")} {line.description} – {t("pdf.quote.markupApplied")}{" "}
                  {line.markupPct ?? 0}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Material Lines (optional) ─────────────────────────────────── */}
        {includeMaterialLines && hasCsvLines && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("pdf.quote.sectionMaterialLines")}</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colDesc}>{t("pdf.quote.description")}</Text>
                <Text style={styles.colSys}>{t("pdf.quote.sys")}</Text>
                <Text style={styles.colQty}>{t("pdf.quote.qty")}</Text>
                <Text style={styles.colLength}>{t("pdf.quote.lengthM")}</Text>
                <Text style={styles.colM2}>m²</Text>
                {showUnitPrice && <Text style={styles.colPrice}>{t("pdf.quote.unit")}</Text>}
                <Text style={styles.colTotal}>{t("pdf.quote.total")}</Text>
              </View>
              {data.lines
                .filter((l) => !l.isIgnored)
                .map((line, i) => (
                  <View
                    key={i}
                    style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  >
                    <Text style={styles.colDesc}>{line.description}</Text>
                    <Text style={styles.colSys}>{line.systemCode ?? "—"}</Text>
                    <Text style={styles.colQty}>{safeFmtN(line.qty, 0)}</Text>
                    <Text style={styles.colLength}>
                      {safeFmtN((line.heightMm ?? 0) / 1000)}
                    </Text>
                    <Text style={styles.colM2}>{safeFmtN(line.m2Line ?? 0)}</Text>
                    {showUnitPrice && (
                      <Text style={styles.colPrice}>{safeFmt(line.unitPrice)}</Text>
                    )}
                    <Text style={styles.colTotal}>
                      {safeFmt(line.lineTotalWithMarkup)}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* ── Logistics (to CIF) ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("pdf.quote.sectionLogistics")}</Text>
          <View style={styles.summaryBox}>
            <SumRow
              label={t("pdf.quote.containers")}
              value={`${data.numContainers} × ${data.kitsPerContainer} ${t("pdf.quote.kitsPerContainer")}`}
            />
            {occupancyPct != null && (
              <SumRow label={t("pdf.quote.containerOccupancy")} value={`${safeFmtN(occupancyPct, 1)}%`} />
            )}
            <SumRow label={t("pdf.quote.freight")} value={safeFmt(data.freightCostUsd)} />
            <SumRow label="FOB" value={safeFmt(data.fobUsd)} bold />
            <SumRow label="CIF" value={safeFmt(data.cifUsd)} bold />
          </View>
        </View>

        {/* ── Financial Summary (from FOB) ───────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("pdf.quote.sectionFinancial")}</Text>
          <View style={styles.summaryBox}>
            {data.basePriceForPartner != null ? (
              <SumRow label={t("pdf.quote.basePriceVisionLatam")} value={safeFmt(data.basePriceForPartner)} />
            ) : (
              <SumRow label={t("pdf.quote.exwFactoryCost")} value={safeFmt(data.factoryCostUsd)} />
            )}
            <SumRow label="FOB" value={safeFmt(data.fobUsd)} bold />
            <SumRow
              label={`${t("pdf.quote.freight")} (${data.numContainers} ${data.numContainers !== 1 ? t("pdf.quote.containersLabelPlural") : t("pdf.quote.containersLabel")})`}
              value={safeFmt(data.freightCostUsd)}
            />
            <SumRow label="CIF" value={safeFmt(data.cifUsd)} bold />
            <SumRow label={t("pdf.quote.totalTaxesFees")} value={safeFmt(data.taxesFeesUsd)} />
            <SumRow label={t("pdf.quote.landedDdp")} value={safeFmt(data.landedDdpUsd)} bold />
          </View>
        </View>

        {/* ── Taxes & Fees (detail) ───────────────────────────────────────── */}
        {data.taxLines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("pdf.quote.sectionTaxesFees")} ({data.country?.name ?? t("pdf.quote.destinationFallback")})
            </Text>
            <View style={styles.summaryBox}>
              {data.taxLines.map((tl, i) => (
                <View key={i} style={styles.taxLine}>
                  <Text style={styles.summaryLabel}>{tl.label}</Text>
                  <Text style={styles.summaryValue}>
                    {safeFmt(tl.computedAmount)}
                  </Text>
                </View>
              ))}
              <SumRow
                label={t("pdf.quote.totalTaxesFeesLabel")}
                value={safeFmt(data.taxesFeesUsd)}
                bold
              />
            </View>
          </View>
        )}

        {/* ── Total DDP ─────────────────────────────────────────────────── */}
        <View style={styles.summaryBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t("pdf.quote.landedDdpTotal")}</Text>
            <Text style={styles.totalValue}>{safeFmt(data.landedDdpUsd)}</Text>
          </View>
          {(Number(data.totalKits) || 0) > 0 && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 8, color: "#666" }}>
                {data.totalKits} kits @ {data.kitsPerContainer}{t("pdf.quote.perContainer")}
              </Text>
              <Text style={{ fontSize: 8, color: "#666" }}>
                {safeFmt((Number(data.landedDdpUsd) || 0) / Math.max(Number(data.numContainers) || 1, 1))}
                {t("pdf.quote.perContainer")} •{" "}
                {safeFmt((Number(data.landedDdpUsd) || 0) / Math.max(Number(data.totalKits) || 1, 1))}{t("pdf.quote.perKit")}
              </Text>
            </View>
          )}
        </View>

        {/* ── Informational ────────────────────────────────────────────── */}
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
              <View style={styles.summaryBox}>
                <SumRow label={t("pdf.quote.wallsM2")} value={tk > 1 ? `${t("pdf.quote.perKitLabel")} ${safeFmtN(m2PerKit)} · ${t("pdf.quote.totalLabel")} ${safeFmtN(m2Total)} m²` : `${t("pdf.quote.totalLabel")} ${safeFmtN(m2Total)} m²`} />
                <SumRow label={t("pdf.quote.concreteM3")} value={tk > 1 ? `${t("pdf.quote.perKitLabel")} ${safeFmtN(m3PerKit)} · ${t("pdf.quote.totalLabel")} ${safeFmtN(m3Total)} m³` : `${t("pdf.quote.totalLabel")} ${safeFmtN(m3Total)} m³`} />
                <SumRow label={t("pdf.quote.steelKg")} value={tk > 1 ? `${t("pdf.quote.perKitLabel")} ${safeFmtN(kgPerKit, 1)} · ${t("pdf.quote.totalLabel")} ${safeFmtN(kgTotal, 1)} kg` : `${t("pdf.quote.totalLabel")} ${safeFmtN(kgTotal, 1)} kg`} />
                {data.totalWeightKgCored != null && (
                  <SumRow label={t("pdf.quote.panelWeightCored")} value={`${safeFmtN(data.totalWeightKgCored)} kg`} />
                )}
                {data.totalVolumeM3 != null && (
                  <SumRow label={t("pdf.quote.panelVolume")} value={`${safeFmtN(data.totalVolumeM3, 2)} m³`} />
                )}
              </View>
            );
          })()}
        </View>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        {data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("pdf.quote.sectionNotes")}</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{data.notes}</Text>
            </View>
          </View>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("pdf.quote.footerConfidential")}</Text>
          <Text style={styles.footerText}>
            {t("pdf.quote.generated")} {new Date().toLocaleDateString(locale === "es" ? "es-ES" : "en-US")} •{" "}
            {data.quoteNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
