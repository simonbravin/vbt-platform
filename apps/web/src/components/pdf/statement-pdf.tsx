import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { PDF_BRAND as C } from "./pdf-brand";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
    color: C.textDark,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    borderBottomWidth: 2.5,
    borderBottomColor: C.accent,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 36,
    height: 42,
    objectFit: "contain",
    marginRight: 10,
  },
  companyName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.navyDark,
  },
  companyTagline: {
    fontSize: 7.5,
    color: C.textMid,
    marginTop: 2,
  },
  docTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.navyDark,
    letterSpacing: 0.8,
  },
  docSubtitle: {
    fontSize: 8,
    color: C.textMid,
    marginTop: 3,
  },
  section: { marginBottom: 16 },
  clientName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.navyDark,
    marginBottom: 6,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
    fontSize: 8.5,
  },
  totalsItem: {
    flexDirection: "row",
    marginLeft: 14,
  },
  totalsLabel: { color: C.textMid },
  totalsValue: { fontFamily: "Helvetica-Bold", color: C.textDark, marginLeft: 4 },
  table: {
    width: "100%",
    marginBottom: 8,
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
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grayBorder,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grayBorder,
    backgroundColor: C.grayBg,
  },
  colSale: { width: "22%", textAlign: "left" },
  colProject: { flex: 1, textAlign: "left" },
  colInvoiced: { width: "18%", textAlign: "right" },
  colPaid: { width: "18%", textAlign: "right" },
  colBalance: { width: "18%", textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: C.grayBorder,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 6.5, color: C.textMuted },
});

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export type StatementPdfData = {
  generatedAt: string;
  filterFrom?: string | null;
  filterTo?: string | null;
  filterClientName?: string | null;
  filterEntityName?: string | null;
  logoDataUrl?: string | null;
  statements: Array<{
    client: { id: string; name: string };
    sales: Array<{
      saleNumber: string;
      projectName: string;
      invoiced: number;
      paid: number;
      balance: number;
    }>;
    totalInvoiced: number;
    totalPaid: number;
    balance: number;
  }>;
};

export function StatementPdfDocument({ data }: { data: StatementPdfData }) {
  const { generatedAt, filterFrom, filterTo, filterClientName, filterEntityName, statements } = data;
  const filterParts: string[] = [];
  if (filterFrom) filterParts.push(`From: ${filterFrom}`);
  if (filterTo) filterParts.push(`To: ${filterTo}`);
  if (filterClientName) filterParts.push(`Client: ${filterClientName}`);
  if (filterEntityName) filterParts.push(`Entity: ${filterEntityName}`);
  const filterLine = filterParts.length > 0 ? filterParts.join(" · ") : "All clients";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View fixed>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              {data.logoDataUrl ? <Image src={data.logoDataUrl} style={styles.logo} /> : null}
              <View>
                <Text style={styles.companyName}>Vision Building Technologies</Text>
                <Text style={styles.companyTagline}>VBT Platform · Account Statements</Text>
              </View>
            </View>
            <View>
              <Text style={styles.docTitle}>Account Statements</Text>
              <Text style={styles.docSubtitle}>Generated: {generatedAt}</Text>
              <Text style={[styles.docSubtitle, { marginTop: 2 }]}>{filterLine}</Text>
            </View>
          </View>
        </View>

        {statements.map((st) => (
          <View key={st.client.id} style={styles.section} wrap={false}>
            <Text style={styles.clientName}>{st.client.name}</Text>
            <View style={styles.totalsRow}>
              <View style={styles.totalsItem}>
                <Text style={styles.totalsLabel}>Invoiced:</Text>
                <Text style={styles.totalsValue}>{formatMoney(st.totalInvoiced)}</Text>
              </View>
              <View style={styles.totalsItem}>
                <Text style={styles.totalsLabel}>Paid:</Text>
                <Text style={styles.totalsValue}>{formatMoney(st.totalPaid)}</Text>
              </View>
              <View style={styles.totalsItem}>
                <Text style={styles.totalsLabel}>Balance:</Text>
                <Text style={styles.totalsValue}>{formatMoney(st.balance)}</Text>
              </View>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colSale}>Sale #</Text>
                <Text style={styles.colProject}>Project</Text>
                <Text style={styles.colInvoiced}>Invoiced</Text>
                <Text style={styles.colPaid}>Paid</Text>
                <Text style={styles.colBalance}>Balance</Text>
              </View>
              {st.sales.map((sale, idx) => (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.colSale}>{sale.saleNumber}</Text>
                  <Text style={styles.colProject}>{sale.projectName}</Text>
                  <Text style={styles.colInvoiced}>{formatMoney(sale.invoiced)}</Text>
                  <Text style={styles.colPaid}>{formatMoney(sale.paid)}</Text>
                  <Text style={styles.colBalance}>{formatMoney(sale.balance)}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View fixed style={styles.footer}>
          <Text style={styles.footerText}>VBT Platform · Account Statements</Text>
          <Text style={styles.footerText}>{generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
