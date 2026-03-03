"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

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
  colLinM: { width: 50, textAlign: "right" },
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
  // Financials
  factoryCostUsd: number;
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
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);

const fmtN = (n: number, d = 1) => n.toFixed(d);

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

export function QuotePdfDocument({ data }: { data: QuotePdfData }) {
  const hasCsvLines = data.costMethod === "CSV" && data.lines.length > 0;
  const belowMinRunLines = data.lines.filter((l) => l.isBelowMinRun);

  return (
    <Document
      title={`Quote ${data.quoteNumber}`}
      author="Vision Building Technologies"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>Vision Building Technologies</Text>
            <Text style={styles.companyTagline}>
              PVC Permanent Formwork Systems • VBT Cost Calculator
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.quoteTitle}>QUOTE</Text>
            <Text style={styles.quoteNumber}>{data.quoteNumber}</Text>
            <Text style={styles.quoteStatus}>{data.status}</Text>
            <Text style={{ fontSize: 7, color: "#888", marginTop: 4 }}>
              {data.createdAt}
            </Text>
          </View>
        </View>

        {/* ── Project Info ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project & Client</Text>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <InfoRow label="Project" value={data.project.name} />
              {data.project.client && (
                <InfoRow label="Client" value={data.project.client} />
              )}
              {data.project.location && (
                <InfoRow label="Location" value={data.project.location} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              {data.country && (
                <InfoRow
                  label="Destination"
                  value={`${data.country.name} (${data.country.code})`}
                />
              )}
              <InfoRow label="Cost Method" value={data.costMethod} />
              <InfoRow label="Base UOM" value={data.baseUom} />
              <InfoRow
                label="Containers"
                value={`${data.numContainers} × ${data.kitsPerContainer} kits`}
              />
            </View>
          </View>
        </View>

        {/* ── Wall Area Summary ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wall Area Summary</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>S80 (80mm)</Text>
              <Text style={styles.infoBoxValue}>
                {fmtN(data.wallAreaM2S80)} m²
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>S150 (6in)</Text>
              <Text style={styles.infoBoxValue}>
                {fmtN(data.wallAreaM2S150)} m²
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>S200 (8in)</Text>
              <Text style={styles.infoBoxValue}>
                {fmtN(data.wallAreaM2S200)} m²
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>Total Wall Area</Text>
              <Text style={styles.infoBoxValue}>
                {fmtN(data.wallAreaM2Total)} m²
              </Text>
            </View>
          </View>
        </View>

        {/* ── Alerts ───────────────────────────────────────────────────── */}
        {belowMinRunLines.length > 0 && (
          <View style={styles.section}>
            {belowMinRunLines.map((line, i) => (
              <View key={i} style={styles.alertBox}>
                <Text style={styles.alertText}>
                  ⚠ Below min run: {line.description} – markup applied:{" "}
                  {line.markupPct}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── CSV Line Items ────────────────────────────────────────────── */}
        {hasCsvLines && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Material Lines</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colDesc}>Description</Text>
                <Text style={styles.colSys}>Sys</Text>
                <Text style={styles.colQty}>Qty</Text>
                <Text style={styles.colLinM}>Lin.m</Text>
                <Text style={styles.colM2}>m²</Text>
                <Text style={styles.colPrice}>Unit</Text>
                <Text style={styles.colTotal}>Total</Text>
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
                    <Text style={styles.colQty}>{fmtN(line.qty, 0)}</Text>
                    <Text style={styles.colLinM}>
                      {fmtN(line.linearM ?? 0)}
                    </Text>
                    <Text style={styles.colM2}>{fmtN(line.m2Line ?? 0)}</Text>
                    <Text style={styles.colPrice}>{fmt(line.unitPrice)}</Text>
                    <Text style={styles.colTotal}>
                      {fmt(line.lineTotalWithMarkup)}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* ── Financial Summary ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.summaryBox}>
            <SumRow
              label={`Factory Cost (${data.costMethod})`}
              value={fmt(data.factoryCostUsd)}
            />
            <SumRow
              label={`Commission (${data.commissionPct}% + ${fmt(data.commissionFixed)} fixed)`}
              value={fmt(data.commissionAmount)}
            />
            <SumRow label="FOB" value={fmt(data.fobUsd)} bold />
            <SumRow
              label={`Freight (${data.numContainers} container${data.numContainers !== 1 ? "s" : ""})`}
              value={fmt(data.freightCostUsd)}
            />
            <SumRow label="CIF" value={fmt(data.cifUsd)} bold />
          </View>
        </View>

        {/* ── Taxes & Fees ──────────────────────────────────────────────── */}
        {data.taxLines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Taxes & Fees ({data.country?.name ?? "Destination"})
            </Text>
            <View style={styles.summaryBox}>
              {data.taxLines.map((tl, i) => (
                <View key={i} style={styles.taxLine}>
                  <Text style={styles.summaryLabel}>{tl.label}</Text>
                  <Text style={styles.summaryValue}>
                    {fmt(tl.computedAmount)}
                  </Text>
                </View>
              ))}
              <SumRow
                label="Total Taxes & Fees"
                value={fmt(data.taxesFeesUsd)}
                bold
              />
            </View>
          </View>
        )}

        {/* ── Total DDP ─────────────────────────────────────────────────── */}
        <View style={styles.summaryBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>LANDED / DDP TOTAL</Text>
            <Text style={styles.totalValue}>{fmt(data.landedDdpUsd)}</Text>
          </View>
          {data.totalKits > 0 && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 8, color: "#666" }}>
                {data.totalKits} kits @ {data.kitsPerContainer}/container
              </Text>
              <Text style={{ fontSize: 8, color: "#666" }}>
                {fmt(data.landedDdpUsd / Math.max(data.numContainers, 1))}
                /container •{" "}
                {fmt(data.landedDdpUsd / Math.max(data.totalKits, 1))}/kit
              </Text>
            </View>
          )}
        </View>

        {/* ── Informational ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Informational (not included in cost)
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>Concrete Required</Text>
              <Text style={styles.infoBoxValue}>
                {fmtN(data.concreteM3)} m³
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>Steel Estimate</Text>
              <Text style={styles.infoBoxValue}>
                {fmtN(data.steelKgEst)} kg
              </Text>
            </View>
            {data.totalWeightKgCored != null && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxLabel}>Panel Weight (cored)</Text>
                <Text style={styles.infoBoxValue}>
                  {fmtN(data.totalWeightKgCored)} kg
                </Text>
              </View>
            )}
            {data.totalVolumeM3 != null && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxLabel}>Panel Volume</Text>
                <Text style={styles.infoBoxValue}>
                  {fmtN(data.totalVolumeM3, 2)} m³
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        {data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{data.notes}</Text>
            </View>
          </View>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Vision Building Technologies • Confidential Quote
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date().toLocaleDateString()} •{" "}
            {data.quoteNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
