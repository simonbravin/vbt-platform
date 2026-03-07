/** Sale amounts by basis (Incoterm). */
export type InvoicedBasis = "EXW" | "FOB" | "CIF" | "DDP";

export const INVOICED_BASIS_OPTIONS: InvoicedBasis[] = ["EXW", "FOB", "CIF", "DDP"];

export function getInvoicedAmount(sale: {
  invoicedBasis?: string | null;
  exwUsd: number;
  fobUsd: number;
  cifUsd: number;
  landedDdpUsd: number;
}): number {
  const b = (sale.invoicedBasis || "DDP").toUpperCase();
  if (b === "EXW") return sale.exwUsd;
  if (b === "FOB") return sale.fobUsd;
  if (b === "CIF") return sale.cifUsd;
  return sale.landedDdpUsd;
}

/** Round to 2 decimals for money comparisons (avoids floating-point issues). */
function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compute sale status from totals and overdue invoices. DRAFT/CANCELLED unchanged. */
export function computeSaleStatus(
  currentStatus: string,
  sale: { invoicedBasis?: string | null; exwUsd: number; fobUsd: number; cifUsd: number; landedDdpUsd: number },
  totalPaid: number,
  hasOverdueInvoice: boolean
): "DRAFT" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "DUE" | "CANCELLED" {
  if (currentStatus === "DRAFT" || currentStatus === "CANCELLED") return currentStatus as "DRAFT" | "CANCELLED";
  const invoiced = roundMoney(getInvoicedAmount(sale));
  const paid = roundMoney(totalPaid);
  if (paid >= invoiced) return "PAID";
  if (paid > 0) return hasOverdueInvoice ? "DUE" : "PARTIALLY_PAID";
  return hasOverdueInvoice ? "DUE" : "CONFIRMED";
}
