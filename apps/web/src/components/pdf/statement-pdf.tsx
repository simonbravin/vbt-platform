import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    borderBottom: "2px solid #1a3a5c",
    paddingBottom: 12,
  },
  headerLeft: { flex: 1 },
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
  docTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#e87722",
  },
  docSubtitle: {
    fontSize: 9,
    color: "#555",
    marginTop: 4,
  },
  section: { marginBottom: 18 },
  clientName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1a3a5c",
    marginBottom: 6,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginBottom: 8,
    fontSize: 9,
  },
  totalsLabel: { color: "#666" },
  totalsValue: { fontFamily: "Helvetica-Bold" },
  table: { width: "100%", marginBottom: 12 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a3a5c",
    color: "white",
    padding: "5 6",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    padding: "4 6",
    borderBottom: "0.5px solid #e8e8e8",
  },
  tableRowAlt: {
    flexDirection: "row",
    padding: "4 6",
    borderBottom: "0.5px solid #e8e8e8",
    backgroundColor: "#f8f9fa",
  },
  colSale: { width: "22%", textAlign: "left" },
  colProject: { flex: 1, textAlign: "left" },
  colInvoiced: { width: "18%", textAlign: "right" },
  colPaid: { width: "18%", textAlign: "right" },
  colBalance: { width: "18%", textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTop: "1px solid #e0e0e0",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#999" },
});

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

export type StatementPdfData = {
  generatedAt: string;
  filterFrom?: string | null;
  filterTo?: string | null;
  filterClientName?: string | null;
  filterEntityName?: string | null;
  statements: Array<{
    client: { id: string; name: string };
    sales: Array<{ saleNumber: string; projectName: string; invoiced: number; paid: number; balance: number }>;
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
            <View style={styles.headerLeft}>
              <Text style={styles.companyName}>Vision Building Technologies</Text>
              <Text style={styles.companyTagline}>VBT Platform · Account Statements</Text>
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
              <Text style={styles.totalsLabel}>Invoiced:</Text>
              <Text style={styles.totalsValue}>{formatMoney(st.totalInvoiced)}</Text>
              <Text style={styles.totalsLabel}>Paid:</Text>
              <Text style={styles.totalsValue}>{formatMoney(st.totalPaid)}</Text>
              <Text style={styles.totalsLabel}>Balance:</Text>
              <Text style={styles.totalsValue}>{formatMoney(st.balance)}</Text>
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
