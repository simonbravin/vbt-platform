/** Panel systems used in catalog / inventory (order for UI chips). */
export const PANEL_SYSTEM_CODES = ["S80", "S150", "S200"] as const;
export type PanelSystemCode = (typeof PANEL_SYSTEM_CODES)[number];

export type StockLineLike = {
  id: string;
  quantity: number;
  lengthMm: number;
  unit: string | null;
  warehouse: { id: string; name: string };
  catalogPiece: { id: string; canonicalName: string; systemCode: string };
};

export type StockGroup<T extends StockLineLike = StockLineLike> = {
  key: string;
  warehouse: T["warehouse"];
  catalogPiece: T["catalogPiece"];
  lines: T[];
};

/** Group stock lines by warehouse + catalog piece (one profile per bucket family). */
export function groupStockByWarehouseAndPiece<T extends StockLineLike>(levels: T[]): StockGroup<T>[] {
  const map = new Map<string, StockGroup<T>>();
  for (const l of levels) {
    const key = `${l.warehouse.id}:${l.catalogPiece.id}`;
    let g = map.get(key);
    if (!g) {
      g = { key, warehouse: l.warehouse, catalogPiece: l.catalogPiece, lines: [] };
      map.set(key, g);
    }
    g.lines.push(l);
  }
  for (const g of map.values()) {
    g.lines.sort((a, b) => Math.round(Number(a.lengthMm ?? 0)) - Math.round(Number(b.lengthMm ?? 0)));
  }
  return [...map.values()].sort((a, b) => {
    const w = a.warehouse.name.localeCompare(b.warehouse.name);
    if (w !== 0) return w;
    const p = a.catalogPiece.canonicalName.localeCompare(b.catalogPiece.canonicalName);
    if (p !== 0) return p;
    return a.catalogPiece.systemCode.localeCompare(b.catalogPiece.systemCode);
  });
}

export function sumQuantities<T extends { quantity: number }>(lines: T[]): number {
  return lines.reduce((s, l) => s + Number(l.quantity), 0);
}

export function distinctLengthMmSorted<T extends { lengthMm: number }>(lines: T[]): number[] {
  return [...new Set(lines.map((l) => Math.round(Number(l.lengthMm ?? 0))))].sort((a, b) => a - b);
}

/** Toggle a code in a set; never remove the last remaining code. */
export function toggleSystemInSet(prev: Set<string>, code: string): Set<string> {
  const next = new Set(prev);
  if (next.has(code)) {
    if (next.size <= 1) return next;
    next.delete(code);
  } else {
    next.add(code);
  }
  return next;
}
