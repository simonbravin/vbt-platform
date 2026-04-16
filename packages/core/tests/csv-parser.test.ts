import { describe, expect, it } from "vitest";
import { parseRevitCsv } from "../src/csv-parser";

describe("parseRevitCsv", () => {
  it("parses classic Revit wall schedule (Type, Count, Length mm)", () => {
    const csv = `Type,Count,Length
SA2024_6in x 9in Form,12,2900
6in Exterior Corner,5,3000`;
    const r = parseRevitCsv(csv);
    expect(r.invalidRows).toBe(0);
    expect(r.validRows).toBe(2);
    expect(r.headerMap.pieceName?.toLowerCase()).toBe("type");
    expect(r.headerMap.qty?.toLowerCase()).toBe("count");
    expect(r.rows[0].rawPieceName).toContain("6in x 9in");
    expect(r.rows[0].rawQty).toBe(12);
    expect(r.rows[0].rawHeightMm).toBe(2900);
    expect(r.rows[0].parseError).toBeUndefined();
    expect(r.rows[1].rawQty).toBe(5);
    expect(r.rows[1].rawHeightMm).toBe(3000);
  });

  it("finds header row after a title line (common Revit CSV export)", () => {
    const csv = `Project Wall Schedule,,,
Type,QTY,Length
Wall A,10,2400`;
    const r = parseRevitCsv(csv);
    expect(r.invalidRows).toBe(0);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].rawPieceName).toBe("Wall A");
    expect(r.rows[0].rawQty).toBe(10);
    expect(r.rows[0].rawHeightMm).toBe(2400);
  });

  it("drops Revit grand total and subtotal-style meta rows", () => {
    const csv = `Type,Count,Length
Panel X,2,3000
Grand total: 999,,,
SA2024_Group: 12,,,`;
    const r = parseRevitCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].rawPieceName).toBe("Panel X");
  });

  it("parses inventory-style export (Piece, Units, Height (m), Matrix)", () => {
    const csv = `Piece,Matrix,System,Height (m),Units
6in x 9in Form,#15552,VBT 150mm,3,114`;
    const r = parseRevitCsv(csv);
    expect(r.invalidRows).toBe(0);
    expect(r.rows[0].rawPieceName).toBe("6in x 9in Form");
    expect(r.rows[0].rawPieceCode).toBe("#15552");
    expect(r.rows[0].rawQty).toBe(114);
    expect(r.rows[0].rawHeightMm).toBe(3000);
  });

  it("keeps Length in mm when header is Length (no meters suffix)", () => {
    const csv = `Type,Qty,Length
Wall B,4,2850`;
    const r = parseRevitCsv(csv);
    expect(r.invalidRows).toBe(0);
    expect(r.rows[0].rawHeightMm).toBe(2850);
  });

  it("accepts qty 0 without parseError (metrics still gated elsewhere)", () => {
    const csv = `Type,Count,Length
Ghost,0,3000`;
    const r = parseRevitCsv(csv);
    expect(r.invalidRows).toBe(0);
    expect(r.rows[0].rawQty).toBe(0);
    expect(r.rows[0].parseError).toBeUndefined();
  });
});
